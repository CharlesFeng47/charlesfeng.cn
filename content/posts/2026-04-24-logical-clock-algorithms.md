---
date: 2026-04-24
title: "逻辑时钟算法 Logical clock algorithms：从 why 到 how"
template: post
thumbnail: "../thumbnails/world-map.svg"
slug: logical-clock-algorithms
categories:
  - Tech
  - Thinking
tags:
  - ChatGPT
  - Distributed System
  - Logical Clock
  - Lamport Timestamp
  - Lamport Clock
  - Hybrid Logical Clock
  - HLC
  - TrueTime
  - Vector Clock
  - Version Vector
  - Matrix Clock
  - ObjectStore
  - Active Directory
  - Geo Replication
---

## 写在前面

分布式系统中的「先后」至少有三种含义：物理时间上谁更早、谁可能影响谁、系统最终把谁排在前面。三者经常一致，但不是一回事。

Logical clock（逻辑时钟）主要处理后两种问题。本文先区分物理时钟同步与逻辑时钟，再依次解释 happens-before、Lamport Clock、HLC、TrueTime、Vector Clock、Version Vector 和 Matrix Clock，最后看真实系统如何选择。

## 0. 为什么 wall clock 物理时钟不够用

Wall clock 并不是持续从某个绝对时间源读取 UTC，而是通过计算本机振荡器的周期来推进时间。振荡频率不可能始终等于标称值，主要有两类原因：

1. **硬件差异。** 计算机内部通常使用石英晶体振荡器。受材料和制造工艺限制，每颗晶振的固有频率都会有微小差异，因此两台同型号机器也可能以不同速度计时。
2. **环境影响。** 温度、湿度、电压波动会改变晶振频率；晶体老化还会让频率随使用时间缓慢变化。同一台机器的时钟因此也可能时快时慢。

严格地说，time drift 是本地时钟相对真实时间的**走速误差**，通常用 ppm（parts per million，百万分之一）表示；clock offset 或 skew 是走速误差随时间累积后形成的**时刻差**。例如，一只时钟快 `20 ppm`，每秒会多走 `20 μs`，在没有同步的情况下，一天会快约 `1.728 s`。若两台机器分别快、慢 `20 ppm`，它们之间的相对偏差一天可增加约 `3.456 s`。

NTP（Network Time Protocol，网络时间协议）和 PTP（Precision Time Protocol，精确时间协议）会持续估算并校正这些偏差：NTP 适合普通 IP 网络，PTP 常在受控局域网中配合硬件时间戳获得更高精度。

它们能缩小误差，但不能让多台机器变成一只绝对准确的钟。网络路径不对称、同步源中断、虚拟机暂停和本地时钟跳变都会留下不确定性。

[Apache Cassandra](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html) 就直接依赖物理时间：mutation timestamp 由客户端提供，或者由 coordinator 的时钟生成；并发值按 Last-Write-Wins（LWW，最后写入胜出）解决。若某节点的时钟快了十秒，它的旧值可能压过真实时间更晚的新值。因此 Cassandra 官方文档明确要求使用 NTP 保持节点时钟适度同步。

这里需要澄清：**逻辑时钟不会校准物理时钟，也不会消除 time drift。** 它解决的是另一类问题：当 wall clock 不可靠，或者问题本身与物理时间无关时，如何表达事件顺序和信息传播关系。

即使所有物理钟完全同步，下面这些问题仍然存在：

1. **因果顺序。** A 在 `12:00` 写入，B 在 `12:01` 写入，不代表 B 见过 A 的结果。
2. **并发冲突。** 两个版本谁包含谁，不能从两个物理时间戳反推出。
3. **确定性排序。** 分布式互斥、日志回放和状态机需要所有节点得到相同顺序，不一定关心真实时间。
4. **复制进度。** 系统需要知道某个来源的哪些变更已经见过，以便去重、恢复和回收日志。

因此要先判断系统真正需要哪一种「时间」：

| 需求                              | 常用机制                 |
| --------------------------------- | ------------------------ |
| UTC 时间、TTL、审计时间、物理 LWW | NTP/PTP                  |
| 不违反因果关系的确定性排序        | Lamport Clock + actor ID |
| 精确区分因果与并发                | Vector/Version Vector    |
| 接近物理时间，同时保留因果单调性  | HLC                      |
| 有明确误差上界的全球物理时间      | TrueTime                 |

这些机制不是互斥的。HLC 的因果单调性不依赖 NTP，但系统若要让其物理分量服务于 MVCC、TTL 等功能，通常仍会同步时钟并限制最大偏差；TrueTime 也依赖时间同步基础设施。逻辑机制负责顺序语义，物理同步负责时间与现实世界的接近程度。

## 1. Happens-before：先定义因果关系

事件（event）是节点上的一次动作，例如修改数据、发送消息或接收消息。记 `a -> b` 为 `a happened-before b`，其定义只有三条：

1. 同一进程中，先执行的事件 happened-before 后执行的事件。
2. 消息的发送事件 happened-before 对应的接收事件。
3. 该关系具有传递性 transitivity：若 `a -> b` 且 `b -> c`，则 `a -> c`。

### 1.1 Causality / Causal Ordering：信息可能从前者影响后者

Causality（因果关系）在这里不是「业务上 A 必然导致 B」，而是**信息是否可能从 A 传播到 B，使 B 的结果依赖 A**。若存在这样的传播路径，就记为 `A -> B`。

例如，客户端创建订单，收到订单号后再发起支付：支付请求携带了订单写入产生的信息，所以 `createOrder -> payOrder`。至于支付是否真的读取了订单的每个字段，并不影响这个关系；happened-before 描述的是潜在影响，不是业务代码的数据流证明。

反过来，若 A 和 B 之间两个方向都没有信息传播路径，就不能说谁导致了谁。即使物理时钟显示 A 更早，它们在因果模型中仍然并发。

看一个贯穿全文的例子：

```text
Process A                        Process B

a: write(x = 1)                  c: write(y = 1)
       |                                |
b: send(m) --------------------> d: receive(m)
                                        |
                                 e: write(z = 1)
```

根据进程内顺序和消息传递：

```text
a -> b -> d -> e
c -> d -> e
```

因此 `a`、`c` 都可能影响 `d` 和 `e`。但 `b` 与 `c` 之间没有任何方向的信息传播路径，所以它们并发，记为：

```text
b || c
```

这里的「并发」不是物理时间完全相同，而是**在 happens-before 偏序中不可比较**。即使墙上时钟显示 `b` 比 `c` 早五分钟，只要两者之间没有信息传播路径，它们仍是并发事件。

判断两个事件是否存在因果关系，最实用的问题是：

> 在 `y` 发生前，关于 `x` 的信息能否沿本地执行或消息传递到达 `y`？

能到达则 `x -> y`；两个方向都不能到达则 `x || y`。

### 1.2 从因果一致性到线性一致性

假设客户端 A 依次执行：

```text
w1: write(x = 1)
w2: write(y = 1)   // w1 完成后才发起
```

因此 `w1 -> w2`。如果客户端 B 已经读到 `y=1`，随后在同一个 causal session 中读取 `x`，Causal Consistency（因果一致性）要求它看到 `w1` 或其后继版本，不能返回 `x=0`。但对于没有因果关系的并发写，因果一致性不规定统一顺序，不同副本可以用不同顺序观察它们。

Linearizability（线性一致性）要求更强。每个操作都必须像是在 invocation（调用）与 response（返回）之间的某个瞬间原子生效；所有操作可以排列成一个符合对象语义的总序，而且必须尊重真实时间：

```text
write(x = 1) 已返回
                         read(x) 才开始
```

那么 `read(x)` 必须看到 `x=1` 或更晚的值。对于时间上重叠的并发操作，系统可以任选一个先后，但针对同一个对象，所有客户端必须服从同一个选择。

从因果关系看，两者的区别是：

| 模型               | 必须保留的顺序                         | 如何处理并发操作                       |
| ------------------ | -------------------------------------- | -------------------------------------- |
| Causal Consistency | happened-before 定义的因果偏序         | 不强制统一排序，不同副本可以不同       |
| Linearizability    | 对象语义，以及非重叠操作的真实时间顺序 | 选入同一个对象总序，并让所有客户端一致 |

粗略地说，在同一个对象的范围内，Linearizability 把因果边和真实时间边一起扩展成全局认可的总序。它是一项一致性语义，不是使用 Lamport Clock 或 Vector Clock 就能自动获得的能力，通常还需要 leader、consensus 或 quorum protocol 来约束读写。

「Strong Consistency（强一致性）」不是一个足够精确的正式模型。它在单对象读写语境中常被用来指 Linearizability；涉及多对象事务时，通常应明确说 Strict Serializability 或 Spanner 的 External Consistency。Per-key linearizability 也只保证单个 key 的顺序，不能自动推出跨 key 事务是线性一致的。

## 2. [Lamport Clock](https://en.wikipedia.org/wiki/Lamport_timestamp)：通过用数字捕获 *happened-before* ordering 保证因果顺序不被排反

Lamport Clock 为每个进程维护一个整数：

```text
本地事件或发送消息：clock = clock + 1
接收消息：clock = max(local_clock, message_clock) + 1
```

把它应用到上面的例子：

```text
Process A                        Process B

a: L=1                           c: L=1
b: L=2  -----------------------> d: max(1, 2) + 1 = 3
                                 e: L=4
```

所有已知因果关系都满足：

```text
x -> y  =>  L(x) < L(y)
```

例如 `b -> d`，所以 `2 < 3`。但反向推导不成立：`L(c)=1 < L(b)=2`，不能推出 `c -> b`；前面已经知道 `b || c`。

这正是 Lamport Clock 的边界：它能保证因果关系不被排反，却不能仅凭两个时间戳判断事件是因果还是并发。若再用某种任意的机制（比如进程 ID）打破时间戳相同的情况，就可以得到稳定的总序，但这种并发事件之间的顺序是人为指定的，不能用来判断因果关系。

因此 Lamport Clock 适合请求排序、分布式互斥和日志排序，不适合检测并发写冲突。

## 3. HLC：接近物理时间，但没有增加因果信息

Hybrid Logical Clock（HLC）把物理时间与逻辑计数器组合成固定大小的时间戳 `(l, c)`：`l` 尽量接近 wall clock，`c` 用来维持因果顺序。它适合 MVCC、快照读取、TTL 和 GC，因为时间戳既可排序，又大致对应现实时间。

但 HLC 与 Lamport Clock 一样，只有单向保证：

```text
x -> y  =>  HLC(x) < HLC(y)
```

假设现实中 `a` 先发生，A 的机器时钟却快了两秒：

```text
真实时间：a 先于 c
HLC(a) = (1002, 0)
HLC(c) = (1001, 0)
```

如果 A、B 尚未通信，那么 `a || c`。此时 `HLC(c) < HLC(a)` 完全合法：HLC 不保证没有因果关系的事件符合真实时间顺序。

当 A 把 `(1002, 0)` 随消息发给 B 后，B 的接收事件必须吸收这个时间戳：

```text
B 原 HLC：        (1001, 0)
消息中的 HLC：     (1002, 0)
B.receive：       (1002, 1)
```

于是 `A.send < B.receive`，因果顺序仍然成立。时钟偏差影响的是「接近现实时间」的程度，不会破坏已经传播到接收方的因果顺序；如果节点时钟跳到很远的未来，TTL、MVCC GC 等依赖现实时间的功能仍可能出问题。

所以 HLC 回答的是：「给我一个接近现实时间、不会违反已知因果顺序的紧凑时间戳。」它不能回答两个写入是否并发。

## 4. TrueTime：把物理时间的不确定性写进 API

TrueTime 不是逻辑时钟，而是 Google 提供的分布式物理时钟 API。普通系统调用返回一个时间点，TrueTime 返回一个区间：

```text
TT.now() = [earliest, latest]
```

它承诺真实时间位于这个区间内。区间宽度反映当前不确定性，来源包括时钟漂移和时间同步延迟。Google 通过 GPS、原子钟和多套 time master 缩小并约束这个区间。

若事件 A 的 `latest` 小于事件 B 的 `earliest`，系统可以确定 A 在真实时间上早于 B；两个区间重叠时，则不能仅凭 TrueTime 判断先后。

[Google Spanner](https://docs.cloud.google.com/spanner/docs/true-time-external-consistency) 使用 TrueTime 为事务选择 commit timestamp `s`。提交读写事务时，transaction coordinator leader 选择的是**提交时间戳**，不是事务的开始时间。`s` 必须不小于 `TT.now().latest` 和所有参与者的 prepare timestamp，并大于该 coordinator leader 此前分配的时间戳。事务完成复制后，还要等待 `TT.after(s)` 为真，也就是确定真实时间已经越过 `s`，才向客户端报告提交成功。这个 commit wait 保证：若事务 T1 已经完成，T2 才开始，那么 `timestamp(T1) < timestamp(T2)`。这就是 external consistency（外部一致性）所需的真实时间顺序。

TrueTime 本身并不能完成事务隔离；Spanner 还需要并发控制、复制和 MVCC。它与 HLC 的差别是：HLC 只保证已传播的因果顺序，不保证未通信节点之间的真实时间顺序；TrueTime 提供物理时间误差上界，但不确定区间越大，commit wait 可能越长。

## 5. [Vector Clock](https://en.wikipedia.org/wiki/Vector_clock)：从时间戳恢复因果关系

Vector Clock 不再用一个整数表示历史，而是为每个进程保留一个计数。两个进程的向量写作 `[A, B]`，规则是：

```text
本地事件或发送消息：自己的分量 + 1
接收消息：逐项取 max，再把自己的分量 + 1
```

仍然使用同一组事件：

```text
Process A                        Process B

a: [1, 0]                        c: [0, 1]
b: [2, 0] ---------------------> d: max([0, 1], [2, 0])
                                     then increment B
                                     = [2, 2]
                                 e: [2, 3]
```

向量按分量比较。若 `Vx` 每一项都不大于 `Vy`，且至少一项更小，则 `Vx < Vy`。

现在比较 `b=[2,0]` 与 `c=[0,1]`：第一项 `b` 更大，第二项 `c` 更大，双方都不小于对方，因此二者并发。再比较它们与 `d=[2,2]`：

```text
[2, 0] < [2, 2]   =>   b -> d
[0, 1] < [2, 2]   =>   c -> d
```

对标准 Vector Clock，有更强的性质：

```text
x -> y  <=>  VC(x) < VC(y)
```

向量不可比较则事件并发。文章 [Why Logical Clocks are Easy](https://queue.acm.org/detail.cfm?id=2917756) 从 causal history 出发解释了原因：Vector Clock 是因果历史集合的压缩表示，向量比较对应集合包含关系。

## 6. [Version Vector](https://en.wikipedia.org/wiki/Version_vector)：把同样的比较用于数据版本

Vector Clock 和 Version Vector 都是整数向量，比较也都按分量进行、规则相同，但二者目的不同：

| 机制           | 追踪对象                        | 主要目的                                 | 比较结果                        |
| -------------- | ------------------------------- | ---------------------------------------- | ------------------------------- |
| Vector Clock   | 分布式进程中的事件              | 建立事件的因果偏序，检测因果关系与并发   | happened-before 或 concurrent   |
| Version Vector | 多个 agent 对同一数据产生的版本 | 追踪版本演化，识别旧版本、后继和并发冲突 | ancestor、descendant 或 sibling |

Vector Clock 回答「事件 `e1` 是否可能影响事件 `e2`」；它会在本地事件、消息发送和消息接收时推进。Version Vector 回答「数据版本 `v2` 是否已经包含 `v1` 的修改」；它通常只在某个 agent 创建新版本，或副本合并版本时变化，而不会为无关的进程事件计数。

因此两者复用了相同的偏序比较，但向量分量的语义不同：Vector Clock 压缩的是事件的 causal history，Version Vector 压缩的是数据的 version history。下面的 A、B 不是任意进程，而是能够独立更新 `x` 的两个 agent。

假设 A、B 最初都保存：

```text
x = 0
VV = {A:0, B:0}
```

网络分区后，两边独立修改 `x`：

```text
A: x = 1, VV = {A:1, B:0}
B: x = 2, VV = {A:0, B:1}
```

两个向量不可比较，所以系统知道它们是并发版本，不能把其中一个误当成另一个的后继。系统可以保留两个 sibling，交给业务合并。假设客户端合并为 `x=3`，在 A 创建新版本：

```text
先合并上下文：max({A:1, B:0}, {A:0, B:1}) = {A:1, B:1}
再推进 A：{A:2, B:1}
```

新向量同时大于两个旧向量，表示新版本已经包含两边的更新，冲突至此闭合。

## 7. [Matrix Clock](https://en.wikipedia.org/wiki/Matrix_clock)：我知道其他节点知道什么

Vector Clock 只记录一阶知识。在节点 `Pi` 的向量中，`Vi[k]` 表示：`Pi` 已知节点 `Pk` 至少执行到了第几个事件。

Matrix Clock（矩阵时钟）把它扩展成 N×N 矩阵 `Mi`：

```text
Mi[i, k] = Pi 已知 Pk 执行到哪里
Mi[j, k] = Pi 已知 Pj 认为 Pk 执行到哪里
```

因此第 `i` 行就是 `Pi` 自己的 Vector Clock；第 `j` 行则是 `Pi` 当前掌握的 `Pj` 的 Vector Clock 视图，这份信息也可能经第三方转发而来。节点发送消息时携带矩阵，接收方按项取最大值并推进自己的逻辑时间，二阶知识便会沿消息传播。

### 7.1 用矩阵判断全局稳定点

假设 A 的事件 `a7` 依次传播到 B、C：

```text
A:a7  -------->  B receives a7  -------->  C receives B's state
```

C 收到 B 的矩阵后，关于来源 A 的这一列可能是：

```text
M_C[A, A] = 7   // C 知道 A 已经知道 a7
M_C[B, A] = 7   // C 知道 B 已经知道 a7
M_C[C, A] = 7   // C 自己已经知道 a7
```

于是 C 可以计算：

```text
stable_A = min(M_C[A, A], M_C[B, A], M_C[C, A]) = 7
```

这表示「据 C 所知，所有节点都已经看到 A 的前 7 个事件」。协议因此可以把 `a7` 之前的消息标记为 globally stable（全局稳定），不再为重传保留对应日志；checkpoint、tombstone 或因果元数据也可以基于同类下界做安全回收。

这里的结论只对 C 当前掌握的信息成立。A、B 要独立做出同样判断，还需要矩阵状态继续传播给它们。

### 7.2 能力与代价

Matrix Clock 并不会比 Vector Clock 更精确地比较两个事件的因果关系；它新增的是「别人知道什么」的二阶知识，因此适合推断全局进度下界 lower bound，而不是产生总序或完成 consensus。

代价也很直接：固定 N 个节点时，每个时钟需要 `O(N²)` 状态，完整消息也可能携带 `O(N²)` 元数据。成员动态加入、退出或长期失联时，矩阵维护和全局最小值都会变得困难。这也是它常见于算法、监控和 GC 设计，却较少以完整形式出现在大规模动态集群中的原因。

## 8. ObjectStore GeoRepl：先筛选冲突，再决定胜者

[ObjectStore](https://www.microsoft.com/en-us/research/blog/evolution-bings-objectstore/) 是 Bing 团队构建的分布式、多租户键值存储。它的 Data-Driven GeoRepl 允许多个数据中心同时写入，并异步复制到其他数据中心。因此，同一个 key 可能在两地互不知情时被修改。

ObjectStore 把冲突检测与冲突解决分开。Partial Vector Clock 的每个分量表示对应数据中心的 Lamport/GCN 进度，用于保留因果上下文；记录的 adjusted Lamport timestamp 则是冲突确认后的默认决胜值。

| 机制                  | 职责                                          |
| --------------------- | --------------------------------------------- |
| Partial Vector Clock  | 判断远端更新与本地版本是否可能并发            |
| Lamport timestamp     | 冲突确认后，按 Latest-Timestamp-Wins 选出胜者 |
| Custom Merge Function | LWW 不符合业务语义时，自定义合并结果          |

### 8.1 一个完整的冲突过程

假设 CH 和 BN 最初都保存 `x=0`。网络中断后，两边独立写入。为了先说明因果关系，下面写出接收端能够重建的完整上下文；这不是实际随消息发送的格式：

```text
CH: x = 2, VC = [CH:11, BN:7]
BN: x = 1, VC = [CH:10, BN:8]
```

两个向量不可比较，因此两个写入并发。网络恢复后，CH 的更新到达 BN，处理过程如下：

1. CH 不发送完整向量，只发送相对上次通知发生变化的分量，例如 `[CH:11]`。BN 用此前保存的 CH 上下文补齐它；缺失分量不是 `0`。
2. BN 将 `x` 映射到一个 key bucket，用该 bucket 的内存向量与重建后的远端向量比较。
3. 若比较结果是「可能冲突」，BN 才从存储中 point read `x` 的 GCN（Global Change Number，全局变更号），用它修正估计向量后再比较。本例会确认两个版本并发。
4. 默认策略比较两个版本的 adjusted Lamport timestamp。若 CH 的时间戳更大，BN 保留 `x=2`；各数据中心应用同一规则后收敛。业务不接受 LWW 时，可以改用 Custom Merge Function。

如果 BN 在写 `x=1` 前已经收到 CH 的 `x=2`，它的新版本会包含 `CH:11`：

```text
CH: x = 2, VC = [CH:11, BN:7]
BN: x = 1, VC = [CH:11, BN:8]
```

此时 CH 的版本小于 BN 的版本，`x=1` 是 `x=2` 的因果后继，不是冲突。区别不在物理时间，而在 BN 写入前是否见过 CH 的更新。

### 8.2 为什么它是 Partial Vector Clock

教科书式 Full Vector Clock 会为每条记录保存所有数据中心的分量，并在每次复制时发送整个向量。数据中心越多，磁盘元数据、内存和网络成本越高。

ObjectStore 从三处削减成本：

1. **网络按变化量发送。** N 个数据中心中，只发送自上次通知后改变的 M 个分量，通常 `M < N`；接收端结合已缓存的远端状态重建比较上下文。
2. **磁盘不保存完整向量。** 记录只携带紧凑的 GCN；只有粗筛命中时才读取它，补足单条记录的判断依据。
3. **本地内存按 bucket 汇总。** 多个 key 共用一个 bucket 级向量，它只是目标记录本地向量的估计，不是该 key 的完整因果历史。

第三层会把同一 bucket 内其他 key 的更新混入摘要，因此 bucket 比较只能给出「可能冲突」。它可能产生 false positive（误报），但不会直接据此覆盖数据：命中后还要 point read 单条记录确认。若 bucket 比较明确无冲突，则直接写入，避免磁盘读取。公开的 Microsoft [Geo-replication conflict detection patent](https://patents.google.com/patent/US12189653B2/en) 描述的正是这套流程。

所以这里的 partial 不是一种能独立、精确还原事件偏序的新 Vector Clock，而是一个保守的冲突预筛器：用更小的网络与存储开销，换取少量额外 point read。它不追求每条记录永久携带 Full Vector Clock，但也不以静默丢失并发更新为代价。

## 9. Active Directory：组合使用多种逻辑进度

Active Directory 没有给每个对象直接套一个教科书式 Vector Clock，而是把不同问题交给不同元数据：

| 机制                                | 回答的问题                                   |
| ----------------------------------- | -------------------------------------------- |
| High-watermark（HWM）               | 从这个复制来源的哪个 local USN 继续扫描？    |
| Up-to-dateness vector（UTD vector） | 某个 originating DC 的变更是否已经见过？     |
| 属性 replication metadata           | 变更到达后，与本地属性版本冲突时谁应该获胜？ |

例如，变更 `p` 最初由 DC-A 产生：

```text
originatingInvocationId = A
originatingUSN = 100
```

`p` 复制到 DC-B 后会获得 B 的 local USN，例如 `200`。DC-C 从 B 拉取时，先用 `HWM[B]` 决定从 B 的 changelog 哪里开始扫描；扫描到 `p` 后，再检查 `UTD[A]`：

```text
UTD[A] >= 100  -> C 已经通过其他路径见过 p，B 不必再发送
UTD[A] < 100   -> C 尚未见过 p，B 需要发送
```

因此 HWM 是复制伙伴之间的扫描游标；UTD vector 是 version-vector-like 的全局已知进度，用于去重；真正应用变更时，还要依靠属性 metadata 做冲突处理。它们共同回答「从哪扫、发不发、收到后怎么合并」，不能互相替代。

这也解释了 [AD 多主复制学习笔记](/study-notes-on-ad-replication) 中几个概念的关系：UTD vector 追踪的是已知变更，不等于对象级冲突检测；conflict resolution 处理的才是并发更新最终如何收敛。

## 10. Riak：从 ClientId Version Vector 到 Dotted Version Vector

Riak 的演进说明了 Version Vector 的真正工程难点：比较规则很简单，难的是在准确因果关系和有界元数据之间取舍。这里的 actor 是产生版本的因果身份，不一定等于客户端、server 或副本数量。

| 阶段                         | Actor       | 解决的问题                     | 新问题                                            |
| ---------------------------- | ----------- | ------------------------------ | ------------------------------------------------- |
| ClientId Version Vector      | Client ID   | 区分不同客户端产生的更新       | 客户端越多，向量越宽，需要频繁 pruning            |
| Vnode Version Vector         | Riak vnode  | actor 数量受副本规模约束       | 一个 vnode 代理多个客户端，产生 sibling explosion |
| Dotted Version Vector（DVV） | Vnode + dot | 保持向量有界，同时区分独立更新 | 每个 sibling 需要额外保存 dot                     |

### 10.1 为什么 Vnode Version Vector 仍不够

早期 Riak 由客户端提供 actor ID，能够区分独立写入，但向量会随客户端数量增长。Riak 后来改用 vnode 作为 actor，让客户端保持无状态，并把向量大小限制在 replication degree 附近。

代价是一个 vnode 会代理多个客户端。假设 X、Y 都基于同一个 context 写入：

```text
client X: context={S:1}
client Y: context={S:1}
```

普通 Version Vector 只知道两次更新都来自 actor S，不能在一个共享向量中准确记录每个 sibling 分别对应哪次更新。Riak 的 Vnode Version Vector 选择保守地保留 sibling，而不是覆盖无法证明为旧版本的值；重复写入后，本应被新版本取代的 sibling 也可能持续累积，形成 sibling explosion。

因此 Riak 的实际问题不是静默丢更新，而是**虚假冲突和 sibling 数量膨胀**。

### 10.2 Dotted Version Vector 如何解决

DVV 把已知因果历史放在共享 context 中，再为每个 sibling 保存一个独立 dot：

```text
version X: context={S:1}, dot=(S,2)
version Y: context={S:1}, dot=(S,3)
```

两个版本的 context 都不包含对方的 dot，因此系统知道它们并发。客户端之后读取并合并二者时，新 context 会同时包含 `(S,2)` 和 `(S,3)`；下一次写入便能精确淘汰这两个旧 sibling，而不会让它们继续累积。

这样 actor 仍然是数量有限的 vnode，dot 则保留每次更新的身份。Riak 2.0 起，bucket type 默认启用 DVV；未使用 bucket type 的传统 bucket 仍可能使用普通 Vector Clock。

## 11. 如何选择

| 机制                                | 主要回答的问题                         | 能判断并发     | 大小                      | 典型用途                 |
| ----------------------------------- | -------------------------------------- | -------------- | ------------------------- | ------------------------ |
| NTP/PTP                             | 当前 UTC 时间大约是什么？              | 否             | `O(1)`                    | 审计、TTL、物理 LWW      |
| Lamport Clock                       | 如何得到不违反因果关系的标量顺序？     | 否             | `O(1)`                    | 排序、互斥、日志         |
| HLC                                 | 如何让标量逻辑时间接近物理时间？       | 否             | `O(1)`                    | MVCC、快照、TTL、GC      |
| TrueTime                            | 当前物理时间的确定区间是什么？         | 否             | `O(1)`                    | external consistency     |
| Vector Clock                        | 两个分布式事件是因果还是并发？         | 是             | `O(N)`                    | 事件因果分析             |
| Version Vector                      | 两个数据版本是谁包含谁，还是并发冲突？ | 是             | `O(R)`                    | 乐观复制、冲突检测       |
| Partial Vector Clock（ObjectStore） | 远端更新是否可能与本地版本冲突？       | 粗筛后精确确认 | 消息 `O(M)`，通常 `M < N` | GeoRepl 冲突检测         |
| Matrix Clock                        | 我知道其他节点知道了什么？             | 是             | `O(N²)`                   | 全局进度、checkpoint、GC |

最容易混淆的结论有三个：

1. NTP/PTP 缩小时钟偏差；逻辑时钟不校时，而是绕开对精确 wall clock 的依赖。
2. 物理时间先发生，不等于 happened-before；没有信息传播路径的事件在因果模型中仍然并发。
3. Lamport Clock 和 HLC 保证因果顺序不被排反；Vector Clock、Version Vector 等向量类机制才能从时间戳本身区分因果与并发。TrueTime 则属于有误差边界的物理时间方案。

## 12. 实际系统中的选择

| 系统                                                         | 使用的时间机制                   | 解决的问题                                   |
| ------------------------------------------------------------ | -------------------------------- | -------------------------------------------- |
| [Apache Cassandra](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html) | 物理 mutation timestamp + NTP    | 用 LWW 合并并发列更新                        |
| [Google Spanner](https://docs.cloud.google.com/spanner/docs/true-time-external-consistency) | TrueTime + commit wait           | 全球事务 external consistency、MVCC snapshot |
| [CockroachDB](https://www.cockroachlabs.com/docs/stable/architecture/transaction-layer) | HLC + NTP/max clock offset       | 事务时间戳、MVCC、因果单调性                 |
| [Redis Enterprise Active-Active](https://redis.io/docs/latest/operate/rs/databases/active-active/) | Vector Clock + CRDT              | 区分新、旧、并发操作，并让多地副本最终收敛   |
| ObjectStore Data-Driven GeoRepl                              | Partial Vector Clock + Lamport   | 先检测并发冲突，再用 LWW 或自定义函数解决    |
| Active Directory                                             | HWM + UTD vector + 属性 metadata | 扫描进度、跨路径去重、属性冲突解决           |
| Riak                                                         | Vnode Version Vector / DVV       | 识别版本因果关系，并抑制 sibling explosion   |

这里的 Redis 特指 Redis Enterprise Active-Active，不是单机版 Redis。它为[数据对象或子对象维护 Vector Clock](https://redis.io/active-active/)，用向量关系判断操作是新版本、旧版本还是并发版本；具体合并规则由 CRDT（Conflict-free Replicated Data Type，无冲突复制数据类型）决定，不同数据结构有[特定的合并行为](https://redis.io/docs/latest/operate/rs/databases/active-active/develop/data-types/)。

## 参考 & Furthur Readings

- [Category: Logical clock algorithms - Wikipedia](https://en.wikipedia.org/wiki/Category:Logical_clock_algorithms)
- [Happened-before - Wikipedia](https://en.wikipedia.org/wiki/Happened-before)
- [Lamport timestamp - Wikipedia](https://en.wikipedia.org/wiki/Lamport_timestamp)
- [Vector clock - Wikipedia](https://en.wikipedia.org/wiki/Vector_clock)
- [Version vector - Wikipedia](https://en.wikipedia.org/wiki/Version_vector)
- [Matrix clock - Wikipedia](https://en.wikipedia.org/wiki/Matrix_clock)
- [Why Vector Clocks are Easy - Riak](https://riak.com/why-vector-clocks-are-easy/)
- [Why Vector Clocks are Hard - Riak](https://riak.com/posts/technical/why-vector-clocks-are-hard/)
- [Vector Clocks Revisited - Riak](https://riak.com/posts/technical/vector-clocks-revisited/index.html?p=9545.html)
- [Vector Clocks Revisited Part 2: Dotted Version Vectors - Riak](https://riak.com/posts/technical/vector-clocks-revisited-part-2-dotted-version-vectors/index.html?p=9929.html)
- [Causal Context - Riak KV Documentation](https://docs.riak.com/riak/kv/2.2.0/learn/concepts/causal-context/index.html)
- [Why Logical Clocks are Easy - ACM Queue](https://queue.acm.org/detail.cfm?id=2917756)
- [Time, Clocks, and the Ordering of Events in a Distributed System - Leslie Lamport, 1978](https://lamport.azurewebsites.net/pubs/time-clocks.pdf)
- [Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases - Kulkarni et al., 2014](https://cse.buffalo.edu/tech-reports/2014-04.pdf)
- [The Evolution of Bing's ObjectStore - Microsoft Research](https://www.microsoft.com/en-us/research/blog/evolution-bings-objectstore/)
- [Detecting conflicts in geo-replication architectures - US12189653B2](https://patents.google.com/patent/US12189653B2/en)
- [Precise Time Synchronization in Semiconductor Manufacturing - NIST](https://www.nist.gov/publications/precise-time-synchronization-semiconductor-manufacturing)
- [Dynamo architecture: Data Versioning - Apache Cassandra](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html)
- [Spanner: Google's Globally-Distributed Database - Google Research](https://research.google/pubs/spanner-googles-globally-distributed-database-2/)
- [Spanner: TrueTime and external consistency - Google Cloud](https://docs.cloud.google.com/spanner/docs/true-time-external-consistency)
- [Transaction Layer: Hybrid Logical Clocks - CockroachDB](https://www.cockroachlabs.com/docs/stable/architecture/transaction-layer)
- [Active-Active geo-distributed Redis - Redis](https://redis.io/docs/latest/operate/rs/databases/active-active/)
- [Active-Active geo-distribution: How conflict resolution works - Redis](https://redis.io/active-active/)
- [Data types for Active-Active databases - Redis](https://redis.io/docs/latest/operate/rs/databases/active-active/develop/data-types/)
- [Conflict-free replicated data type](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)
- [Linearizability: A Correctness Condition for Concurrent Objects - Herlihy and Wing, 1990](https://www.cs.cmu.edu/~wing/publications/HerlihyWing90.pdf)
- [Matrix Time - Distributed Computing: Principles, Algorithms, and Systems](https://www.cambridge.org/il/download_file/175503/)
- [On reducing the complexity of matrix clocks - Drummond and Barbosa, 2003](https://doi.org/10.1016/S0167-8191(03)00066-8)
- [计算机的时钟（四）：TrueTime](https://yang.observer/2020/11/02/true-time/)
