---
date: 2025-06-11
title: '对 AD multimatser replication 多主复制的学习笔记'
template: post
thumbnail: '../thumbnails/active-directory.png'
slug: study_notes_on_ad_replication
categories:
  - Tech
tags:
  - Active Directory
  - Server
  - Database
  - Distributed System
  - Multimaster
  - Replication
  - Thinking
  - ChatGPT
---

## 写在 25.06.11

这篇问答原文整理的范围更大更广，从 24 年八月刚 reorg 完开始接触 AD，到后面一直work on sync engine。大部分问题都通过问 ChatGPT 得到了答案，一些更细节的则是请教同事和 TL。有想过要不要整理为更系统的文章，而不是这样七零八碎的问答集。但是想到 replication 的原理虽然是那么个原理，但是确实理解过程中也有很多小问题，就算系统地写，也是不断加 note 打补丁 😃，所以就这样吧。问答集的形式也挺好的，自己在看的时候也很能回顾当时的心境。

## Q: What's the difference between High watermark vector and UTD vector? They both store the last sync usn.

> High watermark vector is used to mark the highest watermark among the servers, while UTD vector is used for replication. They are not always the same. 
>
> UTD 是“接收方”告诉“来源方”它已经知道哪些 DC 的哪些 USN
> ✅ 来源方根据这张清单跳过不该发的变更
> ✅ 所以 if invocationId in UTD → 是拿接收方的 UTD 来对比
>
> | 特性               | High Watermark (HWM)                 | Up-To-Date Vector (UTD)         |
> | ------------------ | ------------------------------------ | ------------------------------- |
> | 表示什么           | 本地从某个特定来源 DC 拉到的最大 USN | 我知道所有 DC 的哪些 USN 已复制 |
> | 粒度               | 每个来源 DC 一个值                   | 所有 DC 的全局快照              |
> | 作用               | 控制“从哪开始拉”                     | 控制“哪些不需要再拉”            |
> | 是否能避免重复复制 | ❌ 不能                               | ✅ 可以                          |
> | 多路径拓扑下有效吗 | ❌ 不可靠                             | ✅ 可以去重                      |
>
> | 用途                                     | UTD Vector | HWM            |
> | ---------------------------------------- | ---------- | -------------- |
> | 确定 **哪些变更可以跳过**（已知）        | ✅          | ❌              |
> | 确定 **从哪开始拉增量**（source 端 USN） | ❌          | ✅              |
> | 避免重复复制                             | ✅          | ❌              |
> | 减少查找压力、提高效率                   | ✅          | ✅              |
> | 是否和具体 DC 的复制关系有关             | ❌（全局）  | ✅（pair 级别） |

## Q: How replication works with UTD and HWM?

> > 如果某条变更 **originatingInvocationId 是 DC-D**，
> > 但它 **replicate 到 DC-A 的时候被赋予 USN=1120**，
> > 然后 DC-B 来向 DC-A 拉变更 ——
> >
> > A 应该把这个变更发出去吗？还是跳过？
>
> ------
>
> ## 🧠 正确答案：A 会发它，但是否真正“发出去”，要看 B 的 UTD 是否已包含 D 的变更
>
> 也就是说：
>
> > ✅ 变更被“放进 changelog”是按 A 的本地 USN 排的
> > ❗ 但是否发出去，要看变更 **originatingInvocationId = D** 是否在 **B 的 UTD[D] 之内**
>
> ------
>
> ## 📦 再来一步步看：
>
> ### 情况设定：
>
> - 变更来自 DC-D，originatingInvocationId = D_ID, originatingUSN = 5000
> - 它在 DC-A 被 apply 后，A 分配了 `localUSN = 1120`（这个是 A 的 “change log sequence number”）
> - DC-B 准备从 A 拉数据
> - B 的状态：
>
> ```
> HWM[A] = 1000
> UTD = {
>     D_ID = 4900,  // B 从 D 拿到的最大变更是 USN 4900
>     A_ID = 1150,  // B 拿过 A 的本地变更（或间接拿过）
> }
> ```
>
> ------
>
> ### 那么 A 的复制逻辑是：
>
> ```pseudocode
> FOR usn in (1001..currentUSN at A):
>     change = A.changeLog[usn]
> 
>     oid = change.originatingInvocationId // D_ID
>     ousn = change.originatingUSN // 5000
> 
>     IF oid in B'UTD AND ousn <= B'UTD[oid]
>         THEN SKIP
>         ELSE SEND
> ```
>
> 对比 B 的 `UTD[D_ID] = 4900` → 5000 > 4900 → ✅ NOT SKIPPED
>
> ### ✅ 所以：A 会把这条变更传给 B！
>
> ------
>
> ## 🎯 核心理解点：
>
> > **所有变更都按 A 的 USN 排队（用于扫描）**
> > 但变更的 `originatingInvocationId` 和 `originatingUSN` 决定它是否应该被 replicate 出去
>
> ------
>
> ## 🧠 图解思路：
>
> ```
> A 的 changelog:
> 
> USN   | Originating DC | Orig.USN | Object
> ------+----------------+-----------+--------
> 1001  | A              | 1001      | O1
> 1002  | A              | 1002      | O2
> ...
> 1120  | D              | 5000      | O3  ← 这个来自 D！
> ...
> 
> HWM[A] = 1000
> UTD = {
>     A_ID = 1150
>     D_ID = 4900
> }
> ```
>
> 你是 A，要从 USN=1001 开始扫
>  扫到 1120 时：
>
> - 看 `originatingInvocationId = D_ID`
> - 看 `originatingUSN = 5000 > UTD[D_ID]=4900` → ✅ 需要 replicate！
>
> ------
>
> ## ✅ 小结：关键点口诀
>
> ```
> 📌 扫描顺序：按来源 DC 的 HWM → 遍历 local USN
> 📌 判断是否 skip：按变更的 originatingInvocationId + originatingUSN 与接收方的 UTD 比
> 📌 所以 foreign-originated 变更即使 USN 在 A 很早，也可能需要 replicate！
> ```

## Q: UTD vector 什么时候会被更新？

> UTD vector 只会在 **cycle 结束 catch up 上**之后才会更新，注意不是每次 sync 拉了一次 change 就会 cycle 结束，得 source DC 上所有 change 都被拉到 target，=> `objectUsn == propertyUsn`。
>
> Details see [blog](https://rakhesh.com/windows/notes-on-ad-replication-updates-attributes-usn-high-watermark-vector-up-to-dateness-vector-metadata-etc/) below.
>
> > Once a destination DC updates itself from an originating DC – i.e. the replication cycle completes – the source DC sends *its* UTDV table to the destination DC. The destination DC then updates its UTDV table with the info from the received UTDV table. Each entry in the received table is compared with the one it has and one of the following happens:
>>
> > - If the received table has an entry that the destination DC’s UTDV table *does not have* – meaning there’s another DC for this replica that it isn’t aware of, this DC has replicated successfully with the originating DC and so all the info it has is now also present with the destination DC, and so it is as good as saying this new DC has replicated with the destination DC and we are aware of it the same way the originating DC is aware – so a new entry is added to the destination DC’s UTDV table with the name of this unknown DC and the corresponding info from the received UTDV table. 
> > - If the received table has an entry that the destination DC’s UTDV table already has, and its USN value is higher than what the destination DC’s table notes – meaning whatever changes this known DC had for this partition has already replicated with the originating DC and thus the destination DC – and so its entry in the UTDV can actually be updated, the UTDV table for that server is updated with the value from the received UTDV table.  
>>
> > The UTDV table also records timestamps along with the USN value. This way DCs can quickly identify other DCs that are not replicating. These timestamps record the time the DC last replicated with the other DC – either directly or indirectly. 

## Q: Replicate 的时候是按照 Object USN 还是 Property USN？

> DirSync 的时候 Cookie 中包含 object usn 和 property usn, object usn 会是当前对象所有 property usn 中最大的一个（最后一次被更改），replicate 的时候会按照 object usn 排序，所以很可能两个 object，更早被改过的 property 更晚被 replicate。比如对下面的 case，假设当前 HWM 是 400（上一次 sync 完 object/property usn = 400），可能此次 sync 的只有 object B，而 object A 的 property1 会等到下一次 sync 500 的时候才跟随 property2 被 replicate 出去。
>
> Object A (500): property1: 100, property2: 500
>
> Object B (450): property1: 400, property2: 450
>
> **所以 more data 的判断条件是 object usn == property usn，所有的 change 都已经被 sync，dirsync catch up with latest changes。**
>
> 这轮 sync 拉完 object B 之后，cookie 更新 object usn 为 450，但 property usn 还是 400 不变，等到下一次 sync object A 之后，不再有更新的 change，object usn = property usn = 500。
>
> 另外，注要注意的是，Dirsync 在不同 DC 之间 failover 时，比如从 DC1 failover 到 DC2，DC2 上的 AD 会根据 cookie（from DC1）的 UTD vector 数据获取当前 DC2 对应的 usn（同一水位线，DC1/2 在此水位线上已经互相完全同步），并从这个 usn 开始 sync。所以如果 DirSync 没有 catch up 最新的数据（object usn != property usn，UTD vector 没有被更新），failover 之后就可能会拿到重复的已经做过的 change，但这是 by design，AD 为了保证不丢 change。完整文档可参见 [如何跟踪 AD 的 change](/tracking-changes-from-ad)。

## Q: 假设 replication chain 是 A 到 B 到 C，B sync 给 C 的时候有 A 的 source invocation id 和 usn吗？如果没有的话 C 收到之后怎么同时更新对 A/B 的 UTD Vector？

> change 的 metadata 里面总是有 source 相关的信息，所以 C 会收到 A 相关的信息。最后 C 更新 UTD vector 的时机是 C cycle 结束，收到 B 的 UTD vector 后做 merge。B 传给 C 的 UTD vector 里面关于 A 的部分已经在 A sync to B 的时候被更新，所以 C 能接收到 A 的最新值。

## Q: UTD 被更新时只会更新 originating invocationid 那一行吗？还是说 sync source 也会一起更新？

> 如上所说，是根据 UTD vector 做 merge，实际被更新的 records 并不确定。

## Q: UTD vector 中已有的 entry 会被删除吗？比如 DC demote/rebuild 之后，相关 invocationId 都应该不再有意义？

> 不会，会一直保留。目前 vector size 可能有 1k+，可是我们实际只有 24 台 DC，目前没发现什么问题，毕竟只是一个 vector。

## Q: 如果 B 的 UTD[A] = 1150，HWM[A] = 1000，实际  A 在处理的时候就是 1150 以下的都会被认为已经 sync 过，返回的都是 1151-1200 吗？HWM 仍然实际没起作用呀？TODO

> 实际从 A replicate 出去的时候会被跳过。但不确定的是 A 在处理时还是从 1001 开始比，然后在结果集上根据 UTD 筛除，还是在拿到 target B 的 HWM 和 UTD 会比一下取较大值。
>
> HWM就没用了吗？也不是，因为 UTD 只会在 cycle 结束后被更新，大多数情况下 HWM 的值大于 UTD。

## Q: UTD vector is just an improvement but AD could also works without it?

> > **是的，AD 最早期的设计中确实没有完整的 UTD Vector 实现**，
> > 后来为了效率、去重和拓扑复杂度引入了它。
> >
> > **本质上，Active Directory 复制即使没有 UTD Vector，也是能 work 的！**
>
> > ✅ **准确性不会错（consistency still guaranteed）**
> > ❌ **效率会大大下降（duplication + wasted work）**
>
> ------
>
> ## ✅ 没有 UTD 也能复制成功 —— 为什么？
>
> 因为：
>
> 1. **每次拉增量，都是从 HWM 开始往后扫 changelog**
>
> 2. 每条变更里都带有 `originatingInvocationId + originatingUSN`
>
> 3. 如果你已经有这个对象，AD 在应用变更时会比较版本：
>
>   > 🧠 如果本地的对象版本更高，AD 会 **丢弃这个变更**（不会覆盖）
>
> 这就是 AD 的 **版本冲突检测机制**。具体见 "Conflict Resolution" 相关段落。
>
> ------
>
> ## ❗但为什么还要引入 UTD？
>
> > 为了提升性能，减少重复复制，提高 bandwidth + CPU 效率。
>
> 想象一下：
>
> - 没有 UTD，B 每次从 A 拉数据都要从 **HWM+1 扫到现在**
> - 即使之前从别的 DC 已经拿过很多相同变更，A 还是会重新发！
> - B 又要重复做「版本检查」，还要丢弃很多对象，浪费资源
>
> ------
>
> ## 🧪 举个极端例子
>
> ### 有 UTD 的情况：
>
> - A 看你已经知道 `originatingUSN <= 1150`
> - 它从 USN=1151 开始扫
> - 一共发 5 条变更，全部是你真正没见过的
>
> ### 没有 UTD 的情况：
>
> - A 不知道你见过啥
> - 它从 HWM+1 开始扫，一口气发 500 条
> - 你本地丢弃掉 495 条，因为你早就见过了……
>
> ------
>
> ## 🔍 所以我们可以说：
>
> | 有无 UTD Vector | 能不能复制成功？ | 效率如何？ | 关键用途                         |
> | --------------- | ---------------- | ---------- | -------------------------------- |
> | ✅ 有 UTD        | ✅ 100%           | 🚀 高效     | 去重，带宽优化                   |
> | ❌ 没有 UTD      | ✅ 100%           | 🐢 很慢     | 每次都多发，靠版本冲突避免误更新 |
>
> ------
>
> ## 🎓 额外 info：UTD 的历史
>
> UTD Vector 是在 Active Directory 的多主复制架构中引入的优化机制：
>
> - 实现增量复制的“**最小集**”
> - 支持复杂拓扑（如 hub-spoke, ring, partial mesh）
> - 避免“间接复制”带来的重复发送
>
> ------
>
> ## ✅ 终极总结
>
> > **UTD Vector ≠ 保证复制成功的唯一机制**
> >
> > 它是：**一种复制数据去重 + 带宽优化的机制**
> >
> > 没有它，AD 复制 **仍然可靠，但很低效**
>
> ------
>
> ## 🕰️ Active Directory 复制机制演进简史
>
> ### 🔹 Windows 2000（AD v1）—— 最初版本
>
> - 引入 **multi-master replication** 架构（革命性的！）
> - 已经有：
>   - 每个 DC 的 `invocationId`
>  - 每个变更的 `originatingUSN`
>   - 每个 partner 的 `High Watermark`（HWM）
>
> ✅ 可用
> ❌ 但 **没有完整的 UTD Vector 实现**
>  → 每次复制都必须 scan changelog + rely on version checks to avoid overwrite
>
> ------
>
> ### 🔹 Windows Server 2003 / 2003 R2
>
> - 引入了更系统的 **UTD Vector 构造和传输**
> - 复制请求中开始带上 **“我知道谁的 USN 到哪”** 的信息
> - 复制源（source DC）可以根据这份 vector **主动过滤掉对象级别的冗余更新**
>
> 🚀 带宽利用率显著提升
> 📉 减少冲突检查负担
>
> > ✅ 到这一步，AD 的复制变成了「增量 + 去重 + 跨路径有效同步」
>
> ------
>
> ### 🔹 Windows Server 2008+ & Beyond
>
> - 引入了更多复制优化（比如：
>  - `Linked-Value Replication (LVR)`
>   - 更智能的 replication topology management
> - 但 **UTD Vector 机制本身稳定沿用至今**
>
> ------
>
> ## 🔍 为啥一开始没设计 UTD？
>
> 你可以从系统设计者的角度来理解：
>
> > Windows 2000 是当时微软首次实现“多主复制的企业级目录”
> > 初始目标是 **可靠性优先**，哪怕慢、冗余——只要别错！
>
> 所以它先实现了：
>
> - HWM（游标）+ 每个对象的版本检测
> - 再在后续版本里逐步引入：
>   - UTD Vector（全局状态感知）
>  - 冲突解析逻辑
>   - 拓扑优化算法
>
> 这是一种典型的 “先搭稳系统再做优化” 的演进路径。
>
> ------
>
> ## 🧠 你可以理解为：
>
> > **AD 的复制机制 V1 是「log-based, conflict-safe」的**
> > **V2 开始加入「intelligent deduplication with UTD Vector」**
>
> ------
>
> ## 🧪 想试试验证这点？
>
> 你可以在老版 AD（比如 2000/2003 Forest Functional Level）上：
>
> ```powershell
> repadmin /showutdvec
> ```
>
> 🔸 在 Windows 2000 Forest 上，这个命令可能完全没有，或者返回结果非常有限（甚至报错）
> 🔸 从 2003 开始就可以看到清晰的 UTD Vector 列表
>
> ------
>
> ## 🧭 最后一句总结
>
> > UTD Vector 不是让 AD “能同步”的前提
> > 它是让 AD “同步得聪明、高效”的杀手锏。

## Q: 什么是 LVR，为什么需要？

> `Linked-Value Replication (LVR)` 是 Active Directory 中用于提升复制效率和冲突处理能力的一项核心机制，主要用于 **多值属性（multi-valued attributes）** 的复制，比如`member`
>
> ## 🧠 问题背景：为什么需要 LVR？
>
> 早期（Windows 2000）时，AD 对多值属性的复制采用 **整属性复制**，存在两个问题：
>
> 1. **效率低**
>     如果你向一个组里加一个成员，整个成员列表（可能上千个成员）都要被当作一个整体再次复制，非常浪费。
> 2. **冲突处理差**
>     如果两个 DC 同时对同一个组各加一个成员，整属性复制会导致其中一边的更改被丢弃（因为是整体覆盖）。
>
> ------
>
> ## ✅ LVR 是怎么做的？
>
> ### 👉 每一个值都独立复制、带独立元数据
>
> - 你新增或删除组的一个成员，AD 只复制这一项，而不是整个属性值列表。
> - 每个值都有自己的：
>   - **Originating Invocation ID**
>   - **Originating USN**
>   - **Version**
>   - **Timestamp**
>
> ### 🔄 复制时只增量同步
>
> - 比如 A 添加 member=User1，B 添加 member=User2
> - 互相复制时就能合并成 [User1, User2]，而不会覆盖丢失
>
> ## 🔐 技术上怎么实现？
>
> 在属性的定义上会指定：
>
> - `isMemberOfPartialAttributeSet: TRUE`
> - `linkID`：标明这个属性是 link 类型
>
> 有 linkID 的属性：
>
> - 被称为 **linked attributes**
> - LVR 只适用于这些属性（不是所有 multi-valued attribute）
>
> ## 📁 存储结构支持：`msDS-ReplValueMetaData`
>
> - 用来记录每个值的变更元信息
> - 这是区别于 `msDS-ReplAttributeMetaData` 的结构（后者是整属性级别）
>
> ------
>
> ## ✨ 举个例子（组成员）：
>
> 你有组 `CN=Group1`，成员列表是：
>
> - 初始时：member = []
> - DC-A 添加了 User-A → member = [User-A]
> - DC-B 添加了 User-B → member = [User-B]
>
> 有了 LVR：
>
> - A 和 B 互相复制后：
>    → member = [User-A, User-B]
>
> 没 LVR（旧机制）：
>
> - B 会覆盖 A 的修改或反之
>    → member = [User-B] 或 [User-A]
>
> ## ✅ 总结
>
> | 特性                             | LVR Support                         |
> | -------------------------------- | ----------------------------------- |
> | 多值属性是否可按值独立复制       | ✅ 是                                |
> | 冲突时能否合并多方更改           | ✅ 是                                |
> | 是否每个值有独立的复制元数据     | ✅ 是（有 `msDS-ReplValueMetaData`） |
> | 是否适用于所有 multi-valued 属性 | ❌ 否（只适用于有 linkID 的）        |

## Q: USN is typed as `long`, would it be possible to use up of it?

> ## 🧮 能用多久？
>
> **以人类尺度来看，几乎不会用完。我们来算一下：**
>
> 假设一个 DC 每秒 1,000 次变更（这已经非常爆炸）：
>
> ```
> 每年变更数 ≈ 1000 * 60 * 60 * 24 * 365 ≈ 31.5 billion（315 亿）
> ```
>
> 你能用的 USN 范围是：
>
> ```
> 2^64 ≈ 1.8 x 10^19
> ```
>
> 能撑多久：
>
> ```
> 1.8e19 / 3.15e10 ≈ 571 million years 😅
> ```
>
> ✅ 也就是说：**正常运行，USN 是几乎不可能用完的**
>
> ## 😰 但真用完了会怎么样？（理论）
>
> > 如果 USN 用完了，Active Directory 无法为新的变更分配新的 USN
>
> 可能出现的后果：
>
> - 无法写入任何新对象 / 属性
> - 无法复制数据（因为 replication 需要比较 USN）
> - 整个目录系统挂掉（无法产生新的 change log）
>
> 这就类似数据库主键溢出一样，**是灾难级别的事情**
>
> ------
>
> ## 🧯 有没有保护机制？
>
> 虽然微软 **没有官方明说“USN wrap protection”**，但实际有以下防护：
>
> ### ✅ 1. 使用 64-bit 整数，几乎不会 wrap（long enough to last forever）
>
> AD 从一开始就是用 **unsigned 64-bit** 设计的，防溢出风险考虑非常充分。
>
> ### ✅ 2. USN 不是跨 DC 累加的，是 per-DC 自己维护的
>
> 每个 DC 有自己的 USN counter：
>
> ```
> USN@DC1 = 12,345,678
> USN@DC2 = 432,198,321
> ```
>
> 这样避免了全球唯一编号压力。
>
> ### ✅ 3. DC 重建时重新分配 Invocation ID 和新 USN 空间（干净 slate）
>
> 如果真出现奇怪增长（例如：
>
> - 自动脚本疯狂写入
> - replication loop 造成海量版本
> - 逻辑错误导致 USN 快速增长
>
> → 你可以选择重建 DC，换一套 invocationId + 清零 USN
>
> ------
>
> ## ⚠️ 有没有实际案例出现 USN 超限？
>
> 查遍微软 support 和 field case：
>
> > ❌ 目前没有任何一个公开案例表明有 DC 的 USN 用完了
>
> 但微软 AD 团队内部曾经在内部文档中说：
>
> > “USN wrap-around is theoretically possible but practically infeasible due to 64-bit size and per-DC isolation.”

## Q: A 不发送 local usn，那 A 给 B 的数据是按照 local usn 排序的吗？B 在 apply replicated 数据的时候，也是严格按照顺序 apply 的吗？还是会一个包里面随机 apply 呢？

> <u>*单条 record 包含 objectusn/propertyusn，所以 A 发给 B 数据包含 local usn。*</u>
>
> **AD replication is not ordered-by-network, but consistent-by-version.**
>
> ### ❓1. A 给 B 的 replication 数据，是按照 A 的 `localUSN` 排序的吗？
>
> ✅ **是的！**
>
> > Active Directory 在构造 outbound replication queue 的时候，是从 `HWM+1` 开始，**按 `localUSN` 升序扫描 changelog**，也就是按照日志生成顺序（时间顺序）发数据。
>
> 这也是为什么：
>
> - HWM 是游标
> - localUSN 是 changelog 的索引键（有序日志）
>
> ------
>
> ### ❓2. A 发送的时候是不是按顺序发的？
>
> ✅ 是的！
>
> 虽然 replication 采用 **按对象 batching**（按对象归组发包），但：
>
> - 传输顺序是根据 localUSN 的
> - **包内对象顺序可能会被 batching 优化打乱（为了效率），但整体流是基于 changelog 顺序的**
>
> ------
>
> ### ❓3. B 接收到数据，是不是“严格按顺序 apply”？
>
> 🟡 **不一定是“严格顺序”，但逻辑上是“按依赖顺序”保证一致性**
>
> 这是最 subtle 的地方！我们分两种情况讲：
>
> ## 🧠 对象级变更（普通属性更新）
>
> > ✅ B 在 apply replicate 数据时，对每个对象是 **逐个属性 apply** 的
> >
> > ➤ **变更不会乱序覆盖，AD 会比对版本号再应用**
>
> 所以即使一个 batch 里对象乱序、版本顺序乱了，也不会影响最终一致性：
>
> - 属性已经是最新 → 跳过
> - 属性是旧版本 → 覆盖
> - 属性等版本 → 无冲突，覆盖无影响
>
> **==> 版本号（version + timestamp + originatingUSN） 是决定最终写入的关键，不是顺序**
>
> ------
>
> ## 🔗 Linked 属性（如 `member` / `memberOf`）
>
> > 对于这种需要对“多值集合”做增删的：
>
> - AD 使用 **Linked Value Replication (LVR)**
> - 每条“add/remove member” 会独立 replicate + apply
>
> ⏱ 虽然顺序对最终集合状态可能有影响，但 AD 会：
>
> - 按照版本号 + timestamp 排序
> - 确保最终集合的一致性
>
> ## 🚀 并发 apply：AD 内部采用线程池多线程执行 apply 操作
>
> > 所以 replication apply 是 **异步、并发的**，但：
> >
> > - 每个对象内部的变更是原子性的
> > - 每个属性的版本号判断确保最终一致性
> > - replication 引擎保证同一个对象不会被两个线程同时 apply（锁定）TODO replication engine single thread?

## Q: Replication 的数据是怎么 batching 的？batch 大小怎么定？传输的数据里含不含 before value？

> ## 🧠 目录同步数据的分批策略（batching）
>
> ### ✅ 目录复制采用「对象为单位」做 batching，且带有如下策略：
>
> | 维度                   | 是否影响 batch                          |
> | ---------------------- | --------------------------------------- |
> | 对象数量               | ✅ 有默认最大数量（对象/属性数）         |
> | 数据体积               | ✅ 会考虑总大小（最大 RPC payload 限制） |
> | 属性数量               | ✅ 一个对象属性太多会被单独拆成 batch    |
> | 网络条件（压缩、带宽） | ✅ 有影响，尤其是跨站点复制              |
>
> 🧩 真实实现中使用的协议是 **DRS RPC（Directory Replication Service Remote Protocol）**，详见 [MS-DRSR 协议规范](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-drsr/)。
>
> ------
>
> ### 🔸 你可以理解为：
>
> ```
> ReplicaSyncRequest {
>   	StartUsn = HWM+1,
>   	MaxBytes = ~500KB,
>   	MaxObjects = ~1000
> }
> ```
>
> AD 会在返回数据时：
>
> - 拉够一定数量的变更对象
> - 或者达到最大 allowed bytes（例如 512KB）
> - 就形成一个 batch 返回
>
> 📦 所以 batch 是基于「对象数量 + 数据大小 + 属性复杂度」的混合触发规则。
>
> ------
>
> ## 📦 一个 batch 里是什么？
>
> 一个 replication batch 会包含：
>
> | 数据项                                                       | 说明                                                         |
> | ------------------------------------------------------------ | ------------------------------------------------------------ |
> | 对象的 `objectGUID`                                          | ✅ 你改了哪个对象                                             |
> | 所有“变更属性”当前值                                         | ✅ 仅包含新的值（current value）                              |
> | 每个变更的 `originatingInvocationId`, `originatingUSN`, `timestamp`, `versionNumber` | ✅ 用于去重、UTD 比较                                         |
> | 增删信息（如 LVR）                                           | ✅ 对 linked value 属性（如 `member`）会有 add/remove 操作信息 |
>
> ------
>
> ## ❌ 不包含的内容：
>
> | 不包含                       | 理由                                                     |
> | ---------------------------- | -------------------------------------------------------- |
> | 属性的“旧值”（before value） | ❌ 没必要。AD 是 **状态复制**，不是事件溯源系统           |
> | 差异 delta patch             | ❌ 不支持属性内的“增量变更”（比如修改一个字符串的一部分） |
>
> **Replication 是将“修改后的完整属性值”发送给目标**
>
> ## 🧠 为什么不带 “before” 值？
>
> 因为：
>
> - Active Directory 复制是 **状态复制模型**（state-based）
> - 它复制的是“对象的最新状态”，不是“操作序列”
> - 冲突解决依赖 version/timestamp，不依赖变更历史
>
> 所以：
>
> > ❌ AD replication ≠ event sourcing
> > ✅ 它是 a snapshot-delta propagation protocol
>

## Q: 一个 Batch 包大小会跟物理距离有关吗？

> 是的，根据实际体验，一次 DirSync 的包可能与（我们 sync 的 BE 和所使用的 DC 之间的） inter/intra site 物理距离相关，一个包的数据量大小（`avg_DirSyncObjectCount`）可以相差 100x。
>
> ![records-compare-with-site](https://images.charlesfeng.cn/2025-06-11-records-compare-with-site.png)

## Q: LVR 对 link 的 replicate 会带上 old value 吗，不然怎么表示是增加还是删除特定的 value 呢？

> ## 🔁 在 LVR 中，删除（Remove）操作确实需要带上被删除的旧值，否则接收端无法知道删除的是哪个 value。
>
> ### 🔍 为什么要带 old value？
>
> 因为 LVR 的核心是 “**value-level**” 的操作，而非 “attribute-level”。
>
> 举个例子：
>
> - Group `CN=Admins` 的 `member` 属性有多个值。
>
> - 如果你要从中删除一个 member（比如 `CN=Alice`），
>
> - 那么复制时，必须明确告诉目标 DC：
>
>   > “**我要删掉 `member = CN=Alice` 这个具体的值**。”
>
> 这就需要带上被删除的 **old value（CN=Alice）** 以及相关的 metadata（版本号、originating USN、invocationID 等）。
>
> ## ✅ LVR 是如何表示增删的？
>
> LVR 使用特殊的数据结构叫：`msDS-ReplValueMetaData`
>
> 每一个被 replicate 的值，都携带以下元数据字段：
>
> | 字段名                      | 说明                                 |
> | --------------------------- | ------------------------------------ |
> | `LastOriginatingChangeTime` | 时间戳                               |
> | `Version`                   | 增加/删除操作的版本号                |
> | `OriginatingInvocationID`   | 来源 DC 的唯一 ID                    |
> | `OriginatingUSN`            | 来源 DC 上的 USN                     |
> | `LocalUSN`                  | 本地记录的 USN                       |
> | **`Flags`**                 | 指示是“Add” 还是 “Delete” 的关键位 ✅ |
>
> ------
>
> ## 🏷️ `Flags` 字段的定义：
>
> 在内部结构中（比如 REPLVALINF 或 DS_REPL_ATTR_VALUE_META_DATA），`Flags` 是一个位掩码，可能的取值包括：
>
> - `0x0` → 表示这是一个 **添加的值**
> - `0x1` → 表示这是一个 **删除的值**
>
> 事实上，这个flag是：**fIsPresent:** FALSE if and only if the link value has been removed from the attribute.
>
> ------
>
> ## 🧪 举个实际例子（伪结构）：[Real code here](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-drsr/22946fbf-170e-4ab4-82c7-dabdfd97bf5a)
>
> ```
> {
>   "Value": "CN=User1,OU=Users,DC=contoso,DC=com",
>   "OriginatingInvocationID": "{GUID}",
>   "OriginatingUSN": 12345,
>   "Version": 4,
>   "Flags": 0x1,  // ⬅️ 表示这是一个删除操作
> }
> ```
>
> ------
>
> ## 🧠 小结：LVR 增删操作识别方式
>
> | 内容             | 普通属性                     | LVR 属性（如 member/memberOf） |
> | ---------------- | ---------------------------- | ------------------------------ |
> | 操作粒度         | 整体属性                     | 单个 value                     |
> | 是否记录增删操作 | ❌ 不记录                     | ✅ 有明确的 `Add/Delete` 标识   |
> | 元数据结构       | `msDS-ReplAttributeMetaData` | `msDS-ReplValueMetaData`       |
> | 增删标识位置     | 无                           | 在 `Flags` 字段中              |

## Q: 可是 AD replicate 不是 state-based 吗，source DC 怎么知道呢？这条 record usn 对应的 change 就包含了这个信息吗？

> ### 🧠 TL;DR：
>
> 虽然 AD 是 state-based，**每一条 LVR change 记录中仍然带有“这是 Add 还是 Delete” 的语义信息**，因为：
>
> - 每个 LVR 的值在内部被存储成“半对象”，具有自己的 replication metadata。
> - 这份 metadata 就说明了：
>   - 是什么值；
>   - 来自谁（originating DC）；
>   - 在哪里被修改（USN）；
>   - 版本号；
>   - **是否是删除操作（Flags=0x1）** ← ✔ 关键就在这。
>
> ------
>
> ## 🔍 更深入一点：为什么 State-Based 却能做到语义复制？
>
> 我们先对比两者：
>
> | 普通属性复制（非 LVR）      | LVR 属性复制（如 `member`）     |
> | --------------------------- | ------------------------------- |
> | 整个属性作为一个 blob 看待  | 每个值独立被 track 和 replicate |
> | 不知道你是删了 A 还是改成 B | 能精确知道 Add A、Delete B      |
> | 仅根据最终值决定是否发      | 复制“每一条变化”                |
>
> ------
>
> ## ✅ 所以答案是：
>
> > 是的，**这条 change 对应的 originatingUSN 所指向的记录**，就已经包含了 “Add/Delete” 的语义信息。
>
> 因为：
>
> - 在 NTDS 的数据库中（Jet engine），LVR 属性对应的数据结构如：
>   - `REPLVALINF`
>   - `DS_REPL_ATTR_VALUE_META_DATA`
> - 每一项 value metadata 里都带有：
>   - 该值
>   - origin 的信息
>   - 操作版本号
>   - **Flag 表明是否为删除**
>
> 所以哪怕是 state-based 拉增量的范围，比如：
>
> ```
> Give me all changes from USN=12345
> ```
>
> 你返回的 change 里，**就已经是「我要删除哪个 value」这样的语义数据了**。
>
> ------
>
> ## 🧪 举个 LVR 删除的例子：
>
> ```
> {
>   "Attribute": "member",
>   "Value": "CN=Bob,OU=Users,DC=contoso,DC=com",
>   "Version": 5,
>   "Flags": 0x1,  // 表示删除这个值
>   "OriginatingUSN": 12345,
>   "OriginatingInvocationId": "{GUID}"
> }
> ```
>
> ------
>
> ## 📌 小结：
>
> | 项目                      | 是否携带删除语义 | 原因                                      |
> | ------------------------- | ---------------- | ----------------------------------------- |
> | 普通属性复制              | ❌ 不携带         | 只知道当前属性值，不知道怎么变的          |
> | LVR 属性复制（如 member） | ✅ 有明确语义     | 每个值都带 metadata，包含 add/delete 信息 |
>

## Q: 有实际 LVR 的 case 吗？

> LVR works like sequense, full sync will replicate all value data
>
> > ```log
>> member;range=1-1=<GUID=d6b51da7-69e1-4a4f-aba5-b8b5eeb01462>;<SID=S-1-5-21-888882438-985158672-1989895028-2018>;CN=MB12,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=4ba6974e-85b7-4d91-a5c4-0cccb15d3d0b>;<SID=S-1-5-21-888882438-985158672-1989895028-2017>;CN=MB11,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=eb9677fc-73d2-4022-89de-aa0ddbc1c24c>;<SID=S-1-5-21-888882438-985158672-1989895028-2020>;CN=U12,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=763a3dce-f2d0-437c-8fca-25e053605884>;<SID=S-1-5-21-888882438-985158672-1989895028-2023>;CN=U15,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=7399c7bf-18c7-41c1-92fb-a375fc5a14c3>;<SID=S-1-5-21-888882438-985158672-1989895028-2024>;CN=U16,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=4ae9b4b5-d518-411e-9a3b-2b01d81065ed>;<SID=S-1-5-21-888882438-985158672-1989895028-2005>;CN=U10,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=574863a4-e60e-47ed-9e27-d311e1f7c8d8>;<SID=S-1-5-21-888882438-985158672-1989895028-2019>;CN=U11,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=acf68373-2861-4329-9b71-d134f591232d>;<SID=S-1-5-21-888882438-985158672-1989895028-2022>;CN=U14,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=c1440758-da9b-45ea-abf9-8595ba4f6fe5>;<SID=S-1-5-21-888882438-985158672-1989895028-2021>;CN=U13,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=f0912ed3-ea1e-4b4d-aa54-8af2b9805a25>;<SID=S-1-5-21-888882438-985158672-1989895028-2001>;CN=U6,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=e6eb5fcb-c4fc-41d2-9244-4e7ce8953cd2>;<SID=S-1-5-21-888882438-985158672-1989895028-2003>;CN=U8,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=077ed197-e41f-440c-9049-ef613a4fba23>;<SID=S-1-5-21-888882438-985158672-1989895028-2004>;CN=U9,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=f54c7b41-0c55-4462-ae2a-72841937f061>;<SID=S-1-5-21-888882438-985158672-1989895028-2000>;CN=U5,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=8f227922-1411-44a5-aaf1-82c78a66aa4f>;<SID=S-1-5-21-888882438-985158672-1989895028-2002>;CN=U7,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com
> > member;range=0-0=<GUID=159c87f7-5401-41f2-97be-aa8bddfdebd9>;<SID=S-1-5-21-888882438-985158672-1989895028-1999>;CN=U4,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=a0cde7f2-37e8-483e-a54f-792bb46fadfa>;<SID=S-1-5-21-888882438-985158672-1989895028-1998>;CN=U3,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=6fba86e8-f415-4d1b-b425-b6a68252779d>;<SID=S-1-5-21-888882438-985158672-1989895028-1996>;CN=U1,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com,<GUID=6c4c8ce7-cccb-4322-b859-44aff8b9b337>;<SID=S-1-5-21-888882438-985158672-1989895028-1997>;CN=U2,OU=test_domain0521003912.com,OU=Microsoft Exchange Hosted Organizations,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com
> > ```

## Q: 对非 LVR 的复制来说，如果要删除一个property 是怎么做的呢？

> Deleted properties would be placed with empty value (`NULL`) and replicate out with version number increased.

## Q: 如果一个对象非常大（属性很多 or 单个属性特别大），会不会单个对象就超过 batch 限制？那 AD 会怎么处理？能分成多个 batch 吗？

> ## Yes，大对象会导致一个 batch 只能塞一个对象，甚至拆对象属性来分批发！
>
> Active Directory 复制协议（MS-DRSR）做了专门处理这种情况的逻辑，尤其是在遇到：
>
> - 属性特别多的对象（如 `userCertificate`, `member` 多值）
> - 大型单值属性（如 `jpegPhoto`, `userParameters`）
>
> ------
>
> ## 🎯 怎么处理大对象？
>
> ### 👇 DRSR 协议（replication engine）做了以下策略：
>
> | 情况                         | 处理方式                                  |
> | ---------------------------- | ----------------------------------------- |
> | 一个对象大到接近 batch 限额  | ✅ 整个 batch 只发这个对象                 |
> | 对象太大，单个属性块都装不下 | ✅ **拆分属性块分多个 batch**              |
> | 属性多到超过属性上限         | ✅ 对象内容会被分多个 partial records 发出 |
>
> ## 📦 实际效果：
>
> ### ✅ 大对象的属性会被分批 serialize + replicate
>
> 也就是说：
>
> > 一个对象可能需要多个 batch 才能被完整同步完！
>
> 你可以在 `repadmin /showrepl` 或复制 trace 里看到：
>
> ```
> Continuing large object replication
> Partial attribute replication in progress
> ```
>
> 这就是 AD 在做 **多阶段对象复制（chunked replication）**
>
> ------
>
> ## 🧠 例子模拟：
>
> 假设：
>
> - 一个用户对象有 50 个 `proxyAddresses`，每个都很长
> - 加上附带的 `userCertificate`, `thumbnailPhoto`, `description` 等
>
> 单个对象可能 >512KB。
>
> 那 DRSR 会把它切成：
>
> ```
> Batch 1:
>     objectGUID = X
>     attributes:
>         proxyAddresses[0~24]
>         thumbnailPhoto (partial)
> 
> Batch 2:
>     objectGUID = X
>     attributes:
>         proxyAddresses[25~49]
>         thumbnailPhoto (rest)
>         description
> ```
>
> ✅ 最终在目标 DC 上 merge 成完整对象。
>
> ------
>
> ## ⚠️ 注意：
>
> - 这种 chunked replication 机制 **只对 replication 层可见**
> - 应用层（如 LDAP、PowerShell）看到的永远是完整对象
> - 分块是临时行为，只为传输用，最后 merge 再 apply

## Q: DC 之间互相 replicate 的时候也会等待拿到至少有个完整的对象吗？中间 sub batch 对 DC 可见吗？

> ## 🧠 答案概要：
>
> | 问题                   | 答案                                                         |
> | ---------------------- | ------------------------------------------------------------ |
> | 分片是否立即可见？     | ❌ 否，直到整个对象复制完成前，这个对象的变更 **对目标 DC 是不可见的** |
> | 是什么机制保证一致性？ | ✅ 内部有“replication queue” 和“apply gating”机制，确保完整后才 commit |
> | 如果复制失败怎么办？   | 复制失败的片段不会被 apply，整个对象 replication 会被重试    |
>
> ## 📦 更详细解释：
>
> ### 🧩 1. 大对象复制如何分片？
>
> - AD 复制过程使用一种叫 `DS_REPL_OBJ` 结构体的数据包。
> - 当一个对象非常大（可能由于：
>   - 属性数量太多（例如 `member` 上千个）；
>   - 某个属性内容很大（如照片、证书、描述）；
> - 就会把这个对象的复制 change 拆成多个数据包（sub-batches）来传输。
>
> #### 举个例子：
>
> 一个对象包含的数据总量为 2MB，AD 当前复制 batch 限制为 512KB：
>
> - 第一次复制：Header + 属性块1（500KB）
> - 第二次复制：属性块2（500KB）
> - ...
> - 第四次复制：最后一块（200KB）
>
> 所有这些 sub-packets 会在接收方 AD 的内存缓冲中组装。
>
> ------
>
> ### 🔒 2. Sub-batch 是否“可见”？
>
> ❌ **不会被立即 apply 到目录数据库**，不会被其他 API 查询看到！
>
> - 接收端 DC 会暂存在「Replication Receive Queue」中。
> - AD 复制引擎（KCC + DRS）只有在完整对象拼接完毕、结构验证通过之后，才会写入 Jet（NTDS.dit）中。
> - 在此之前，其他 LDAP 或 AD API 查询不到这个对象的新状态。
>
> ------
>
> ### 🔄 3. 什么情况会失败或回滚？
>
> - 如果网络中断、中途失败或源 DC 重启等，目标 DC 会清除尚未完成的部分。
> - 下次 sync 会重新请求整个对象（除非 partial 成功记录被支持 —— 通常不会）。

## Q: 属性很多的时候不是有 LVR 吗？还会分 batch 吗？

> | 特性           | 是否避免分 batch？ | 说明                                                         |
> | -------------- | ------------------ | ------------------------------------------------------------ |
> | **LVR 开启后** | ❌ 不避免           | LVR 是优化“属性层面的复制逻辑”，不是传输层面的打包机制       |
> | **对象太大**   | ✅ 会分 batch       | 即使用了 LVR，只要 total data 超出 batch 限制（默认 512KB），仍需分批 |

## Q: [Conflict Resolution] 如果在 AD v1（没有 UTD Vector）的时候，B 收到 A 发来的 change，要怎么判断这个 change 是不是自己已经 apply 过了？是不是只能遍历所有 local change 看是否匹配？这其实也就是 usn？
> ## ✅ 简明结论：
>
> > 在没有 UTD Vector 的年代（如 Windows 2000 初代 AD），
> > **AD 是靠每个对象的“属性版本元数据（Replication Metadata）”来做精确比对**，不是遍历所有 change log。
>
> 所以：
>
> - ❌ **不会遍历 local changelog**
> - ✅ **会直接比对当前对象上的属性元数据**
>
> ------
>
> ## 🧠 那时是怎么实现去重的？
>
> AD 每个对象在本地都保存了一份 **“属性级别的 replication metadata”**，它包含：
>
> ```
> attribute: mail
> originatingInvocationId: A_ID
> originatingUSN: 1200
> version: 5
> timestamp: 2025-04-10T08:00Z
> ```
>
> 当 B 收到 A 发来的 change：
>
> ```
> originatingInvocationId = A_ID
> originatingUSN = 1200
> attribute = mail
> version = 5
> ```
>
> 它会去比对自己本地 User-X 的 `mail` 属性的版本：
>
> - 如果本地已有：
>
>   ```
>   originatingInvocationId = A_ID
>   originatingUSN = 1200
>   version = 5
>   ```
>
>   → ✅ 一模一样，认为 **已经 apply 过** → **跳过**
>
> - 如果本地没有、或者版本较低 → **apply**
>
> ------
>
> ## 🎯 那这些属性 metadata 存在哪？
>
> 在每个对象的隐含属性中叫做：
>
> ```
> msDS-ReplAttributeMetaData
> ```
>
> 你可以用 `repadmin /showobjmeta` 或 `ldifde` 读出来。
>
> ------
>
> ## 🔁 所以过程简化成：
>
> 1. B 收到变更（change）来自 A
> 2. 对应对象已经存在
> 3. B 查看该对象上变更属性的 metadata：
>    - 看 `originatingInvocationId`
>    - 看 `originatingUSN`
>    - 看 `version`
> 4. 如果完全一样 → skip
>     如果更旧 → apply 覆盖
>
> ------
>
> ## ✅ 所以最终回答你的问题：
>
> | 问题                                | 答案                                                      |
> | ----------------------------------- | --------------------------------------------------------- |
> | 没有 UTD Vector 怎么判断重复？      | 靠对象上每个属性的 replication metadata（不是 changelog） |
> | 会遍历所有 local USN 的 change 吗？ | ❌ 不会。不会回查 changelog                                |
> | 需要 changelog 吗？                 | ✅ changelog 只是作为发送时数据源，apply 不用它            |
>
> ------
>
> ## 🔍 为什么后来还需要 UTD Vector？
>
> 因为：
>
> > 属性级 metadata 能判断“是否重复”，
> > 但 **不能避免 A 发给 B 这条变更**！
>
> 所以：
>
> - 有 metadata → 可以 skip 变更
> - 但没有 UTD → 变更还是会被重复发
>
> 📉 这就浪费带宽 + 计算资源

## Q: Windows Server 2003 引入 UTD Vector 后，AD 还会不会存 `msDS-ReplAttributeMetaData`？如果会，那是不是“只是不用它了”？
> ## ✅ 精准回答：
>
> > **Windows 2003 之后仍然存 `msDS-ReplAttributeMetaData`，而且一直用！**
> > UTD Vector 是用来“减少重复发送”
> > 而 `msDS-ReplAttributeMetaData` 是用来“决定是否应用变更”
>
> 也就是说：
>
> > ✅ 两者在复制机制中并不是**替代**关系，而是**配合**关系！
>
> ------
>
> ## 🧠 各自的职责总结一下：
>
> | 机制                      | 用于                                            | 是否仍保留          | 从属对象                |
> | ------------------------- | ----------------------------------------------- | ------------------- | ----------------------- |
> | **UTD Vector**            | 判断变更是否应该从 Source DC 发出来（全局过滤） | ✅ 保留（2003+引入） | 会话级别，用于复制会话  |
> | **ReplAttributeMetaData** | 判断变更是否应该被应用（属性级别判断）          | ✅ 一直存在          | 每个对象的属性 metadata |
>
> ------
>
> ## 🧬 再来个现实类比理解：
>
> 你可以把这俩理解成：
>
> | 机制                  | 类比                                                         |
> | --------------------- | ------------------------------------------------------------ |
> | **UTD Vector**        | 快递公司派件前判断：“你是不是已经收到这个包了？”             |
> | **AttributeMetaData** | 你签收时看快递内容：“这货是不是我已经有了版本？是不是更新？” |
>
> ------
>
> ## ✅ 所以即使有 UTD Vector，B 仍然要：
>
> 1. **用 UTD Vector 判断哪些变更 A 不需要发给我（源端过滤）**
> 2. **一旦收到变更，B 还会比对自己对象上的 metadata：**
>    - `originatingInvocationId`
>    - `originatingUSN`
>    - `version`
>
> 来决定 apply or skip。

## Q: 如果收到一条 change，它的 replication metadata version 比我本地的还低，该怎么处理？应该 drop 还是覆盖？

> ## ✅ 答案简明：
>
> > **应该 drop，不 apply。**
> >
> > AD 复制引擎会做 **版本号 + originating metadata 比对**，
> > 如果收到的 change 比本地版本旧，就 **直接丢弃该属性变更**。
>
> ------
>
> ## 🧠 原因：Active Directory 是 **state-based**, version-aware replication
>
> 它不是 naive apply 的复制，而是：
>
> > **始终以对象每个属性的 `versionNumber`、`originatingUSN`、`originatingInvocationId` 为依据判断是否接纳变更。**
>
> ------
>
> ## 🔍 具体判断逻辑是这样的：
>
> 当收到一条变更，系统会检查：
>
> ### 对应本地该对象属性是否存在？
>
> - 如果 ❌ 没有 → apply ✅
> - 如果 ✅ 有 → 比较以下字段：
>
> | 字段                        | 用途                   | 决策                                  |
> | --------------------------- | ---------------------- | ------------------------------------- |
> | **versionNumber**           | 每次变更会加一         | ✅ 更高 → apply；更低 → drop           |
> | **timestamp**               | 发起时间               | conflict resolver fallback            |
> | **originatingInvocationId** | 区分不同 DC            | 冲突检测中关键身份信息（GUID 大的赢） |
> | **originatingUSN**          | 发起变更时该 DC 的 USN | 更高优先（辅助判断）                  |
>
> 如果 version 更低，那这条变更即使 UTD Vector 不小心漏掉了它，**也不会生效**！
>
> ------
>
> ## ✅ 所以这是一种双保险机制：
>
> 1. **UTD Vector** → 控制“要不要发”
> 2. **属性级 metadata（msDS-ReplAttributeMetaData）** → 控制“要不要 apply”
>
> ## ⚠️ 为什么 version 会更低还发过来了？
>
> 虽然这种情况很少，但可能会发生：
>
> | 原因                       | 描述                                       |
> | -------------------------- | ------------------------------------------ |
> | **UTD Vector 不准**        | 复制链断、metadata 失效、invocationId 重置 |
> | **回滚 VM / 快照还原**     | DC 恢复旧快照，导致 USN/metadata 倒退      |
> | **DC 被 demote + promote** | UTD vector 没更新，但 replica 还留旧记录   |
> | **人工干预 / 低层写入**    | admin script 或 API 绕过正常 version 流程  |
>
> 所以 AD 的设计非常稳健：
>
> > **哪怕复制链条错发了旧数据，也不会覆盖掉最新版本**

## Q: 如果 version 比我本地小（5 < 6），但 originatingUSN 却比我本地大（1300 > 1200），怎么办？是不是数据坏了？会 apply 吗？还是 drop？

> ## ✅ 正确答案先说：
>
> > **这种变更会被** ❌ **drop，不会 apply**。
> >
> > 因为 **版本号是第一判断依据**，它代表变更的“逻辑顺序”。
>
> ------
>
> ## 🧠 为什么 AD 要这样做？
>
> Active Directory 复制冲突处理逻辑是：
>
> > **先看 versionNumber → 再看 timestamp → 再看 originatingUSN（辅助）**
>
> 所以即使：
>
> - `originatingUSN = 1300`（看上去更新）
> - `versionNumber = 5`（但比我已有的 6 小）
>
> 🛑 AD 认为这是一个「**旧版本**」→ **直接丢弃！**
>
> ------
>
> ## 🔬 微软官方冲突解决顺序是这样：
>
> ### 按顺序判断：
>
> 1. **versionNumber**
> 2. **timestamp**
> 3. **originatingInvocationId**（tie-break）
> 4. **originatingUSN**（辅助排顺序，但不是冲突裁定主依据）
>
> ------
>
> ## ❗那为什么会出现 version < 本地、USN 却 > 本地的情况？
>
> 你真的挖到了一个现实中可能出 bug 的边缘场景：
>
> | 场景                                 | 原因                                       |
> | ------------------------------------ | ------------------------------------------ |
> | **人工写入或脚本绕过**               | 修改属性但不自增版本（绕过 API 层）        |
> | **快照还原**                         | AD 还原到过去的状态，但 USN 被修改为未来值 |
> | **DC 未正常更新 version**            | 某些系统 bug / 内部 API 忽略 version bump  |
> | **调用低层 DS API 时设置了错误字段** | 如 `DsReplicaUpdateRefs` 使用了错误值写入  |

## Q: 如果收到的变更 version = 7（比我已有的 6 高）✅，但它的 `originatingUSN = 1100`（比我记录在 UTD 里的 1200 小）❌，到底 apply 不 apply？

> ## 🧠 快答结论：
>
> > ❌ **不会 apply。会被 replication 引擎 skip 掉，甚至连发都不发。**
>
> 即使 version = 7，看起来逻辑上“更新”—— **但因为 originatingUSN ≤ UTD[A_ID]（我认为你已经发过 ≤1200 了），所以我根本不会从你这儿拿这个变更！**
>
> ## ✅ 你发现了 UTD Vector 的重大风险点之一：
>
> > **UTD 是基于 originatingUSN 的“乐观推测”机制，它不看版本号、不看属性内容，只看“你声称自己发到哪了”！**
>
> 所以：
>
> - 如果 UTD[A_ID] = 1200
> - 你发来的变更 USN = 1100 → 🚫直接跳过，**不会 even check version**
> - 即使 version 是 7（高于我本地的 6）→ 😱 我也 miss 掉了！
>
> ------
>
> ## 🧯 为什么 AD 要这样做？
>
> 因为 AD 假设：
>
> > **originatingUSN 是单调递增的**，不会回退
> > **版本号应该随 USN 同步递增**，不会 version 更高但 USN 更小
>
> 换句话说：UTD 认为：USN 是变更顺序的可信代表
>
> ⚠️ 所以如果 USN “穿越回去”了（USN 小但版本高），就意味着：
>
> - 出现了数据不一致
> - UTD 被误导
> - 当前 DC 会漏 apply 合法的更新（你说得对）
>
> ------
>
> ## ✅ 那现实中怎么办？
>
> 这就是为什么：
>
> ### 🔥 Active Directory 强烈依赖以下前提：
>
> | 保证                             | 描述                                  |
> | -------------------------------- | ------------------------------------- |
> | USN 递增                         | 所有新变更必须用更大的 originatingUSN |
> | version 同步递增                 | 每次属性修改都必须 version++          |
> | 不允许回滚 DC 快照               | 否则会产生 USN 倒退、UTD 不准         |
> | DC crash 恢复必须换 invocationId | 否则其他 DC 以为你是之前的自己        |
>
> ------
>
> ## 💡 微软实际处理这种情况的方法：
>
> | 场景                             | 应对策略                                                     |
> | -------------------------------- | ------------------------------------------------------------ |
> | 快照恢复 / USN 倒退              | 强制分配新 `invocationId`，旧的 UTD 记录不再生效             |
> | 检测到 version higher, USN lower | 会产生一致性告警（Event 1988），并需 admin 介入              |
> | 受害对象被标记                   | 标记为 inconsistent，对象会被“重新 full sync”（MS内部称为 reconciliation） |
>
> ------
>
> ## ✅ 所以最终你的判断是对的：
>
> > 💣 如果 version 比本地高，但 originatingUSN 比我 UTD 记录还小 →
> > **这条更新被默默 skip，AD 认为“我早拿过你了”，实际却错过了**
>
> 这就是：
>
> > **UTD vector 的盲区：它只 trust USN，不检查 version**

## Q: 区分 source DC 的 UTD Vector Check 和 target DC 的 Conflict Resolution 

> ## 🧠 所以必须分清两种判断机制：
>
> | 机制                    | 判断时机                         | 用来做什么           | 决策基础                                   | 目标       |
> | ----------------------- | -------------------------------- | -------------------- | ------------------------------------------ | ---------- |
> | **UTD Vector Check**    | ✅ 在 **source DC 决定发不发** 时 | 是否把这条变更发给你 | `originatingInvocationId + originatingUSN` | 节省带宽   |
> | **Conflict Resolution** | ✅ 在 **target DC 接收到变更后**  | 要不要 apply         | `versionNumber → timestamp → originId`     | 保证一致性 |
>
> ### ✅ 这两段逻辑发生在：
>
> ```
> [A → B replicate] 期间：
> 
> Step 1: A 扫 changelog，HWM+1 开始
> Step 2: 对每条变更，判断是否 in B’s UTD
> ❌ 如果 USN ≤ UTD → skip → B 永远看不到这条变更
> 
> Step 3: 若通过，A 发变更给 B
> 
> Step 4: B 收到 → 进入 Conflict Resolution 流程
> 1️⃣ version 更高 → apply
> 1️⃣ version 相同 → check timestamp
> 1️⃣ 最后 tie-breaker: originating ID
> ```

## Q: 如果 DC A 在 t1 改成了 v1，DC B 在 t2 改成了 v2，两个变更彼此不知道，因为还没同步，现在 A 和 B 互相同步，会发生什么？谁赢？谁被 drop？
> ## ⚖️ AD 的 Conflict Resolution 顺序（再次强调）：
>
> 当同一个属性（如 `mail`) 在多个 DC 被并发修改时，AD 判断哪个版本胜出的流程是：
>
> ```
> 1️⃣ versionNumber    → 谁的版本号高谁赢
> 2️⃣ timestamp        → 谁的时间更新谁赢（更晚 wins）
> 3️⃣ originatingInvocationId → GUID 大的赢（tie-breaker）
> ```
>
> ## 🧾 所以最终 A 的 changelog + 对象状态是：
>
> - changelog entry（localUSN = A 本地分配的）
> - metadata 更新成「**来自 B 的更新**」的那一条
>
> ## 💡 微妙但重要的点：
>
> > **A apply 了来自 B 的变更，但它不会认为这是自己发的！**
> > 因为 metadata 是：origin = B
>
> 所以如果以后 C 来问 A 拉数据：
>
> - A 会把这条来自 B 的变更再次 relay 给 C
> - 但仍然会保留：originatingInvocationId = B
>
> 这就是 **transitive replication 的核心**！
>
> ## 🎯 为什么 v1 会“丢”？
>
> 你说得对，它的确是丢了，但这里的“丢”不是 bug，而是 Active Directory **明确的设计选择**：
>
> > AD replication 不保留每一条变更的历史，不合并冲突，只保留最后赢下来的值。
>
> ------
>
> ## ✅ 用更正式的说法：
>
> ### AD 是：
>
> - ❌ **event-sourcing（事件流）系统**
> - ✅ **state-based (状态同步) 系统**
>
> > 它同步的是：**每个对象、每个属性的“最终状态”**，而不是「发生了哪些事」。
>
> ### 🚫 v1 就这样“死”了：
>
> | 项目                     | 会发生？                       |
> | ------------------------ | ------------------------------ |
> | 被记录到 changelog？     | ✅ 是的，在 A 本地 changelog 中 |
> | 被 replicate 给其他 DC？ | ❌ 不会，version 比 v2 低       |
> | 被应用？                 | ❌ 未来不会了                   |
> | 会被找回来吗？           | ❌ 除非你手动恢复或查日志备份   |
>
> ## ✅ 为什么要这样设计？
>
> 因为：
>
> - 📈 为了 **性能和可扩展性**
> - 💥 多主系统中「合并」太复杂，冲突难以定义
> - 🤝 相比之下，**简单 + deterministic 的“last writer wins”模型**更稳妥
> - 🧠 AD 依靠版本号、timestamp 和 origin ID 来保证“所有 DC 最终一致”

## Q: CNF 对象是怎么产生的？发生命名冲突时，是谁的对象会被改名（变成 CNF）？是 Source 还是 Target？被改名的对象，会不会自动 version+1？是谁来做？

> <u>*AD 实际也会依据类似 attribute level conflict 的方式（VersionNumber、Timestamp、InvocationId）处理 object level conflict，实践可以参考我这篇  [AD 如何通过 CNF 对象来解决冲突？](/how-ad-resolve-conflicts-with-cnf-objects)*</u>
>
> ## ~~✅ 回答 1：永远是 target（接收端）重命名它自己的对象，source 保留不动~~
>
> ~~举例：~~
>
> - ~~DC-A 创建了 `CN=Alice`（objectGUID = X）~~
> - ~~DC-B 也创建了一个 `CN=Alice`（objectGUID = Y）~~
> - ~~现在 **A → B 发起 replication**~~
>
> ~~在同步过程中：~~
>
> - ~~B 会发现：我本地也有一个 `CN=Alice`，GUID 不一样~~
> - ~~A 发来的对象必须“落入”同一个 DN~~
> - ~~所以 B 必须 **保留一个（通常保留 A 的）**~~
> - ~~**B 会主动重命名它自己的对象，加上 `\0ACNF:{GUID}`**~~
>
> ~~🧠 **源端 A 的对象永远不改，只有目标端 B 的对象会被系统“保护性重命名”**~~
>
> ## ✅ 回答 2：会触发 version +1，而且是 AD replication 引擎主动做的
>
> 当目标 DC（比如 B）重命名它自己的冲突对象时：
>
> - 会改动对象的 `CN`（名字）
> - 属于属性层面的变更
> - 所以系统会：
>   - ✅ 自动 version++
>   - ✅ 更新 timestamp
>   - ✅ 写入 `msDS-ReplAttributeMetaData`
>   - ✅ 新的 localUSN 被记录
>
> **即使这个变更不是你手动触发的，AD replication 引擎也会按照完整 apply 流程写入元数据**

## Q: CNF 的 GUID 判断和之前 conflict resolution 的 version、timestamp 等是什么关系呢？

> 这是Active Directory 冲突解决的两条分支逻辑 之间的接口边界——也就是：
>
> 🔍「对象层面（Object-level）冲突判断」 和
> 🔍「属性层面（Attribute-level）冲突解决」之间的关系！
>
> # 🌱 先说两个不同层级的“冲突”
>
> | 层级             | 触发条件                    | 判定依据                           | 行为                    |
> | ---------------- | --------------------------- | ---------------------------------- | ----------------------- |
> | 🧱 **对象级冲突** | DN 相同，但 objectGUID 不同 | **ObjectGUID**                     | 重命名其中一个 → CNF    |
> | 🧩 **属性级冲突** | 对象 GUID 相同，属性值不同  | **version → timestamp → originId** | 谁赢 apply，另一个 drop |
>
> ## 1️⃣ 对象级冲突：先判定 ObjectGUID 是否一致
>
> 这发生在同步之初，当你要将一个对象 "落地" 到目标 DC：
>
> ```pseudocode
> sourceObject.DistinguishedName == targetObject.DistinguishedName
> ```
>
> 系统就要比对：
>
> ```pseudocode
> if sourceObject.ObjectGUID != localObject.ObjectGUID
> → 命名冲突！
> ```
>
> ### ~~✅ 冲突解决方式：~~
>
> - ~~保留 source（即复制过来的对象）~~
> - ~~改名 local 的对象，加 `\0ACNF:{GUID}` 后缀~~
> - ~~对 local 对象触发 rename（CN 属性变更），并 version+1~~
>
> ~~👉 **这个阶段根本不管 version、timestamp 等 attribute-level 元数据**~~
>
> ------
>
> ## 2️⃣ 属性级冲突：只有当对象 GUID 相同才会进入
>
> 如果：
>
> - 同一对象（`objectGUID` 相同）
> - 属性有多个版本（A 改了、B 也改了）
>
> 才会触发我们之前讲的：
>
> ```
> 1. Compare version
> 2. If tie, compare timestamp
> 3. If tie, compare originatingInvocationId
> ```
>
> 这个逻辑是 per-attribute 的，不管对象是否曾冲突。
>
> ------
>
> ## 🧠 所以“谁先谁后”的顺序是：
>
> ```
> When replicating an object:
> 
> Step 1️⃣ Check if DN is already occupied
>   └─ if no → create object
>   └─ if yes → check ObjectGUID
> 
>     Step 1a: if GUID same → proceed to attribute merge
>     Step 1b: if GUID different → object conflict
>        → accept the object with larger version number, timestamp, invocation id
>        → rename another one to CNF
> 
> Step 2️⃣ For each attribute:
>     → compare version / timestamp / originId
>     → apply or drop accordingly
> ```
