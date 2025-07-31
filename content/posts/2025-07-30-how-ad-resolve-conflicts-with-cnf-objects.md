---
date: 2025-07-30
title: 'AD 如何通过 CNF 对象来解决冲突？'
template: post
thumbnail: '../thumbnails/ad-cnf.png'
slug: how-ad-resolve-conflicts-with-cnf-objects
categories:
  - Tech
tags:
  - Active Directory
  - Practices
  - Multimaster
  - Replication
  - Thinking
---

## 背景

因为 AD 是一个多主系统，多个 DC 上可以同时被写入同一 DN 的 object，不过之后当这些 object 在 DC 之间 sync 时，DC 通过将其中一个 rename 为 CNF 对象的方式来解决冲突。那么，DC 会保留哪一个对象呢？

+ 组里面同事的观点是：object level conflict 应该和 attribute level confilict 类似，每个 DC 会按照特定的规则（VersionNumber、Timestamp、InvocationId）处理，这样可以保证所有的 DC 按照同样的规则处理后得到的结果是一样的，以达到最终一致。
+ ChatGPT 的回答不太稳定，但都是保留特定一端的对象。
  + [去年问的时候说](/study_notes_on_ad_replication) 永远是 target（sync 的接收端）重命名它自己的对象，source 保留不动。
  + 今年问的时候回答如下，保留 target 端的 local 对象，重命名 source 端的 object。

> ## 🎯 你问的是：
>
> > DC B 向 DC A replicate 时，A 检测到有 **CN 冲突**，于是生成 `CNF` 对象。此时，A 会保留 **自己的对象（GUID A）**，还是来自 B 的对象（GUID B）？
>
> ## ✅ 简明答案：
>
> **A 会保留它本地已有的对象（GUID A），并将来自 B 的对象（GUID B）保存为一个 `CNF` 重命名对象。**
>
> ## 🔍 原因与机制详解：
>
> 当 Active Directory 的两个 DC 上**独立创建了同一个 CN**（但 GUID 不同）时：
>
> - 系统无法通过 USN 或属性版本号判断“哪一个是更新的”，因为它们是两个完全不同的对象。
> - 同步时（例如 DC B 向 DC A 复制），DC A 会尝试将对象 B 引入本地。
> - 由于目标命名容器（如 OU）中已经有一个同名的 CN 对象（对象 A），**CN 冲突发生**。
> - 解决办法是：
>   - **保留本地已有对象 A（GUID A）不变**
>   - **把从 B 复制来的对象 B（GUID B）改名为 CNF 名称，并写入 A 的目录**
>
> 举例，原始 CN 都是 `CN=charlesfeng`
> 冲突后，DC A 上会出现：
>
> ```
> CN=charlesfeng               → 本地已有对象 A（GUID A）
> CN=charlesfeng\0ACNF:<GUID>  → 从 B 复制来的冲突对象 B（GUID B），被改名为 CNF 对象
> ```
>
> ## 🔁 总结规则
>
> | 冲突场景                            | 决定谁留下         | 冲突对象去向     |
> | ----------------------------------- | ------------------ | ---------------- |
> | **CN 冲突，GUID 不同**              | 本地现有对象保留   | 新对象改名为 CNF |
> | **属性冲突（同一对象 GUID）**       | 属性版本号较高的赢 | 替换属性         |
> | **同 GUID 同 CN（误删重建或恢复）** | 看 USN / 版本      | 标准复制处理     |

那么就还是实践看结果吧。

## Cutting off the Replication Chain

我们在 domain `SG2TDSO1000094D.extest.microsoft.com` 中有两台 DC，`SG2TDSO1000094` 和 `SG2TDSO400002J`。

| Alias | DC             | Originating DSA                      |
| ----- | -------------- | ------------------------------------ |
| B     | SG2TDSO1000094 | 9aaeaf75-2fdf-48a1-8bea-00c6d2d110bd |
| A     | SG2TDSO400002J | cf415bca-7f4e-44f5-a525-2f6c4891b8d7 |

为了构造 DN 相同但 objectGuid 不同的两个对象，我们需要先禁用两台 DC 之间的 replication。可以通过命令 `repadmin /options <DC> +/-DISABLE_OUTBOUND_REPL/DISABLE_INBOUND_REPL` 来做到这一点。


```powershell
PS C:\Users\administrator> repadmin /options SG2TDSO400002J.SG2TDSO1000094D.extest.microsoft.com +DISABLE_OUTBOUND_REPL
Current DSA Options: IS_GC
New DSA Options: IS_GC DISABLE_OUTBOUND_REPL

PS C:\Users\administrator> repadmin /options "SG2TDSO400002J.SG2TDSO1000094D.extest.microsoft.com" +DISABLE_INBOUND_REPL
Current DSA Options: IS_GC DISABLE_OUTBOUND_REPL
New DSA Options: IS_GC DISABLE_INBOUND_REPL DISABLE_OUTBOUND_REPL

PS C:\Users\administrator> repadmin /options "SG2TDSO400002J.SG2TDSO1000094D.extest.microsoft.com"
Current DSA Options: IS_GC DISABLE_INBOUND_REPL DISABLE_OUTBOUND_REPL
```

[官方文档](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/cc770963(v=ws.11)) 中其实没有提到参数 `/options`，但[另一篇文章](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2003/cc772726(v=ws.10))有提到 Inbound 是 `repsFrom` 该 DC 从其他 DC 接收更改，Outbound 是 `repsTo` 该 DC 向其他 DC 发送更改。可以理解为 traffic 方向 🥸。（这跟 ChatGPT 的理解是一致的，虽然不知道他又是从哪里学来的，让给官方链接也全是 error，比如 [repadmin /options | Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/repadmin-options)、[MS-ADTS: Disable Replication Option Flags](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-adts/944147f6-f26c-466c-b78c-44c660d4bcb2)。（可能就是曾经存在，但现在已经被删吧，毕竟你也你知道你软的 doc support。。））

我的操作都是在 DC B `SG2TDSO1000094` 上进行的。因为这个 flag 是 disable 反着来的，所以一开始就很担心被绕晕 😵‍💫。想着在实践之前就记录下期望的结果总不会错了吧，结果测试完发现关于 inbound/outbound 理解似乎出了偏差？ 怎么是反着来的。Anyway，被删除线划掉的是预期的结果，没被划掉的是实际上的测试结果。`T` 代表此方向的 change 可以被 replicate，反之 `F` 则不行。

| Flags on B                                    | Replication Chain       | B -> A  | A -> B  |
| --------------------------------------------- | ----------------------- | ------- | ------- |
| +DISABLE_INBOUND_REPL, +DISABLE_OUTBOUND_REPL | Bidirection unavailable | F       | F       |
| +DISABLE_INBOUND_REPL                         | Outbound available      | ~~T~~ F | ~~F~~ T |
| +DISABLE_OUTBOUND_REPL                        | Inbound available       | ~~F~~ T | ~~T~~ F |
|                                               | Bidirection available   | T       | T       |

## 普通对象的 CNF

#### Round 1：冲突对象在 DC A 上的创建时间晚于 B

| 理论                             | 解决冲突的 DC | 保留 |
| -------------------------------- | ------------- | ---- |
| Version、Timestamp、Invocationid | B             | A    |
| Always retain local object       | B             | B    |
| Always retain remote object      | B             | A    |

1. `+DISABLE_OUTBOUND_REPL`、`+DISABLE_INBOUND_REPL`，A/B 停止互相 replicate。
2. DC B 创建 object `charlesfengtoconflict`，objectGuid 为 `1bd8b315-04ee-4e3a-a27e-f1d3c363eba6`，创建时间为 23:56:16。

![](https://images.charlesfeng.cn/2025-07-30-1.2.PNG)

3. DC A 创建 object `charlesfengtoconflict`，objectGuid 为 `9758a20f-0675-4f32-9775-12fbae0b3f2d`，创建时间为 23:56:30。

![](https://images.charlesfeng.cn/2025-07-30-1.3.PNG)

4. `-DISABLE_OUTBOUND_REPL`，仍有 `+DISABLE_INBOUND_REPL`，A 可以 replicate 给 B。

5. DC B 解决冲突，保留 A 的（不过不能说明基准是更晚 timestamp 还是 always 保留对方的，因为此 case 两种情况相同），把 B 自己原有的对象 rename 为 CNF 对象，更新时间为 23:58:53。

![](https://images.charlesfeng.cn/2025-07-30-1.5.PNG)

6. `-DISABLE_INBOUND_REPL`，A/B 互相可以 replicate。
7. DC A 同步结束，保留 B 解决完的结果，即 A 自己原有的对象不变，B 创建的 CNF 对象被同步。但  `cn` 被 local 修改，version 为 1 而不是 2，local 更新时间为 00:05:05。

![](https://images.charlesfeng.cn/2025-07-30-1.7.PNG)

8. DC B 同步结束，没有任何改变。

#### Round 2：冲突对象在 DC B 上的创建时间晚于 A

| 理论                             | 解决冲突的 DC | 保留 |
| -------------------------------- | ------------- | ---- |
| Version、Timestamp、Invocationid | B             | B    |
| Always retain local object       | B             | B    |
| Always retain remote object      | B             | A    |

1. `+DISABLE_OUTBOUND_REPL`、`+DISABLE_INBOUND_REPL`，A/B 停止互相 replicate。
2. DC A 创建 object `charlesfengtoconflict2`，objectGuid 为 `4b2970ff-a18b-4ea7-9b11-dcb8228ed650`，创建时间为 00:14:30。

![](https://images.charlesfeng.cn/2025-07-30-2.2.PNG)

3. DC B 创建 object `charlesfengtoconflict2`，objectGuid 为 `64ce6d01-e64f-43c4-8399-6377f41db224`，创建时间为 00:15:51。

![](https://images.charlesfeng.cn/2025-07-30-2.3.PNG)

4. `-DISABLE_OUTBOUND_REPL`，仍有 `+DISABLE_INBOUND_REPL`，A 可以 replicate 给 B。
5. DC B 解决冲突，保留 B 自己的（timestamp 更晚的而不是坚持保留对方的），把 A 的对象 rename 为 CNF 对象，更新时间为 00:17:28。

![](https://images.charlesfeng.cn/2025-07-30-2.5.PNG)

6. `-DISABLE_INBOUND_REPL`，仍有 `+DISABLE_OUTBOUND_REPL`，只允许 B replicate 给 A。
7. DC A 同步结束，保留 B 解决完的结果，即保留 B 创建的对象，而 A 自己原有的对象变成 CNF 对象。A 自己原有的对象 `cn` version++。两个对象 metadata 都被更新，local 更新时间为 00:20:56。

![](https://images.charlesfeng.cn/2025-07-30-2.7.PNG)

8. `-DISABLE_OUTBOUND_REPL`，A/B 互相可以 replicate。
9. DC B 同步结束，CNF 对象 metadata 被再次更新，更新时间为 00:25:26。（TODO：不是很理解这里。本来觉得是因为 A 更新了 CNF 对象的 `cn` ，version++ 变为 2，而 B 同步前 local version 为 1，对此 1 -> 2 的新 change 会产生同步。可是在 Round 1 中，最后 DC A/B 上的 CNF 对象 `cn` version 也不一致，但是就不会产生被同步为一样的值了。）

![](https://images.charlesfeng.cn/2025-07-30-2.9.PNG)

#### 小结

CNF 对象都是在 DC B 解决 A replicate to B 时产生的，一次保留的是 A 另一次是 B，说明跟 source/target 无关。但是，两次被保留的对象都是 timestamp 更大的，所以从实践看仍遵循 attribute level conflict 的处理规则。

再者，我们可以从一个更复杂的 case 来思考这个问题。如果复制拓扑是线性链条 A ---> B <--- C，A/C 之间不会互相 replicate。在 A/C 上面分别创建 DN 相同的对象，当它们都跟 B sync 时，B 需要解决冲突，B 会保留哪一个呢？假设冲突对象在 DC A 上的创建时间晚于 C，列出以下表格帮助分析。

| 理论                             | 解决冲突的 DC | 保留                     |
| -------------------------------- | ------------- | ------------------------ |
| Version、Timestamp、Invocationid | B             | A                        |
| Always retain local object       | B             | 取决于 A/C 谁先与 B 同步 |
| Always retain remote object      | B             | 取决于 A/C 谁先与 B 同步 |

如果如 ChatGPT 所言，总是保留一端的对象，那么实际解决冲突时，因为 B 自己本身并没有 conflict 对象，一切都将取决于 A/C 与 B 之前的同步顺序。如果 B 总是保留 local 对象，那么它会保留它最早接收到的对象的原始 CN，后到的对象会被重命名为 CNF 对象。

那么问题就出现了。如果 A 先与 B 同步，C 再与 B 同步，那么 B 解决冲突时会保留 A 创建的对象并将 C 创建的对象 rename CNF。可是这样的结果如果因为网络问题不能被 replicate 到全局，我们此时让 A/C 互相同步并且由 C 来解决冲突，那么 C 会保留自己的，并将 A 创建的对象 rename CNF。 现在让 A/B/C 三者 full mesh 都可以同步，那么会发现 B/C 仍有 object level conflict（objectGuid 不一致但 CN 一致），仍需要解决 CNF，但是相关的 CNF 对象也已经被创建了，CNF 对象也会有重名问题，这样没有办法达到最终一致。

不过，如果按照统一的方式处理（Version、Timestamp、Invocationid），不管是 A/B/C 最后都会保留 A 而将 C 上创建的对象 rename CNF，从而达到最终一致。就算因为网络分区/可达性，由不同的 DC 来处理冲突，保留的结果和被 rename CNF 的对象都是确定的，objectGuid 也是一样的，这样就算这些对象之后需要在不同 DC 之间同步，最多也就是 attribute level conflict，而不会再有 CNF conflict 了。

## 对象被重复删除时会产生 CNF 对象吗？

不会，因为它们 objectGuid 相同，实际是同一对象，只是 attribute level conflict。不过说到这里了，那就试一试。

#### Round 3：被删除对象在 DC A 上的删除时间晚于 B

1. DC B 创建 object `charlesfengtodelete`，objectGuid 为 `874a4067-875e-43eb-aaba-6c8032c10256`，创建时间为 00:35:22。

![](https://images.charlesfeng.cn/2025-07-30-3.1.PNG)

2. DC A 从 B 上 replicate 此对象，local 创建时间为 00:35:23。

![](https://images.charlesfeng.cn/2025-07-30-3.2.PNG)

3. `+DISABLE_OUTBOUND_REPL`、`+DISABLE_INBOUND_REPL`，A/B 停止互相 replicate。
4. DC B 删除此对象，删除时间为 00:39:41。

![](https://images.charlesfeng.cn/2025-07-30-3.4.PNG)

5. DC A 删除此对象，删除时间为 00:41:27。

![](https://images.charlesfeng.cn/2025-07-30-3.5.PNG)

6. `-DISABLE_INBOUND_REPL`，仍有 `+DISABLE_OUTBOUND_REPL`，B 可以 replicate 给 A。
7. A 收到 B 的 change，保留 A 自己的 change（因为 version 相同都为 2，但 A timestamp 更大），没有任何变动。

![](https://images.charlesfeng.cn/2025-07-30-3.7.PNG)

8. `-DISABLE_OUTBOUND_REPL`，仍有 `+DISABLE_INBOUND_REPL`，只允许 A replicate 给 B。
9. B 收到 A 处理之后的 change，`cn` version++，更新时间为 00:45:59。其他 metadata 更新为 A 上对象的值。

![](https://images.charlesfeng.cn/2025-07-30-3.9.PNG)

10. `-DISABLE_INBOUND_REPL`，A/B 互相可以 replicate。
11. A/B 同步结束，没有任何改变。A 上 `cn` version 不变，仍然是 2。

#### Round 4：被删除对象在 DC B 上的删除时间晚于 A

1. DC B 创建 object `charlesfengtodelete2`，objectGuid 为 `387e14f0-8cc6-4aaa-8ef6-acbbc5a21f17`，创建时间为 00:57:08。

![](https://images.charlesfeng.cn/2025-07-30-4.1.PNG)

2. DC A 从 B 上 replicate 此对象，local 创建时间为 00:57:23。

![](https://images.charlesfeng.cn/2025-07-30-4.2.PNG)

3. `+DISABLE_OUTBOUND_REPL`、`+DISABLE_INBOUND_REPL`，A/B 停止互相 replicate。
4. DC A 删除此对象，删除时间为 00:59:18。

![](https://images.charlesfeng.cn/2025-07-30-4.4.PNG)

5. DC B 删除此对象，删除时间为 01:00:10。

![](https://images.charlesfeng.cn/2025-07-30-4.5.PNG)

6. `-DISABLE_INBOUND_REPL`，仍有 `+DISABLE_OUTBOUND_REPL`，B 可以 replicate 给 A。
7. A 收到 B 的 change，保留 B 的 change（因为 version 相同都为 2，但 B timestamp 更大），并将 metadata 更新为 B 上对象的值。`cn` version++，更新时间为 01:01:33。

![](https://images.charlesfeng.cn/2025-07-30-4.7.PNG)

8. `-DISABLE_OUTBOUND_REPL`，仍有 `+DISABLE_INBOUND_REPL`，只允许 A -> B。
9. B 收到 A 的 change，没有任何变动。

![](https://images.charlesfeng.cn/2025-07-30-4.9.PNG)

10. `-DISABLE_INBOUND_REPL`，A/B 互相可以 replicate。
11. A/B 同步结束，没有任何改变。

## 总结

1. 解决 object level conflict、创建 CNF 对象的逻辑和 attribute level conflict 类似。（ChatGPT 又胡说啦 😷）
1. Object metadata AttID 为 3 的属性 `cn` 的更新有时会被 replicate 有时不会，不太理解。。

## 参考

+ [Repadmin](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/cc770963(v=ws.11))
+ [How the Active Directory Replication Model Works](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2003/cc772726(v=ws.10))
+ [Turn on that Scary DC](https://techcommunity.microsoft.com/blog/coreinfrastructureandsecurityblog/turn-on-that-scary-dc/258950)

## Appendix 1: Attribute Mapping

![](https://images.charlesfeng.cn/2025-07-30-attribute-mapping.PNG)

通过 ldp 查看 metadata 和命令 `repadmin /showobjmetadata` 有一点点小差别，但结合起来看，我们可以知道有如下表的对应关系。

| AttID | Attribute              |
| ----- | ---------------------- |
| 0     | objectClass            |
| 3     | cn                     |
| 20001 | instanceType           |
| 20002 | whenCreated            |
| 20030 | isDeleted              |
| 200a9 | showInAdvancedViewOnly |
| 20119 | nTSecurityDescriptor   |
| 90001 | name                   |
| 9030d | lastKnownParent        |
| 9030e | objectCategory         |
| 9080a | isRecycled             |

## Appendix 2: Replication Does Not Resume After Re-enabling Inbound Replication

> 你提到：
>
> > `+DISABLE_INBOUND_REPL` 后又执行了 `-DISABLE_INBOUND_REPL`，但仍然没有发生同步。
>
> 这种情况确实可能发生，以下是可能原因和排查建议：
>
> ## 🧠 原理回顾
>
> 当你执行：
>
> ```
> repadmin /options <DC> +DISABLE_INBOUND_REPL
> ```
>
> 你是**临时告诉这台 DC 不接收复制**，这会阻止来自其他 DC 的入站复制请求。
>
> 当你随后执行：
>
> ```
> repadmin /options <DC> -DISABLE_INBOUND_REPL
> ```
>
> 你是**恢复入站复制能力**，但它**不会自动触发一次同步**。
> 它只是让这台 DC **重新具备“可以同步”的资格**，但并不会马上进行一次复制。
>
> ## ✅ 如何触发手动同步
>
> 你需要**手动触发一次同步**，命令如下：
>
> ```powershell
> repadmin /syncall <DC主机名或FQDN> /AeD
> ```
>
> 含义：
>
> | 参数 | 作用                                             |
> | ---- | ------------------------------------------------ |
> | `/A` | 所有 Naming Context（如 domain、config、schema） |
> | `/e` | 跨站点                                           |
> | `/D` | 显示每个对象的详细同步信息                       |
>
> 例如：
>
> ```powershell
> repadmin /syncall SG2TDSO400002J.SG2TDSO1000094D.extest.microsoft.com /AeD
> ```

```powershell
PS C:\Users\administrator> repadmin /syncall "SG2TDSO400002J.SG2TDSO1000094D.extest.microsoft.com" /AeD
Syncing all NC's held on SG2TDSO400002J.SG2TDSO1000094D.extest.microsoft.com.
Syncing partition: CN=Schema,CN=Configuration,DC=SG2TDSO1000094D,DC=extest,DC=microsoft,DC=com
CALLBACK MESSAGE: The following replication is in progress:
    From: 9aaeaf75-2fdf-48a1-8bea-00c6d2d110bd._msdcs.SG2TDSO1000094D.extest.microsoft.com
    To  : b36c1250-bbd1-44c1-a74a-ca121ab8e538._msdcs.SG2TDSO1000094D.extest.microsoft.com
CALLBACK MESSAGE: The following replication completed successfully:
    From: 9aaeaf75-2fdf-48a1-8bea-00c6d2d110bd._msdcs.SG2TDSO1000094D.extest.microsoft.com
    To  : b36c1250-bbd1-44c1-a74a-ca121ab8e538._msdcs.SG2TDSO1000094D.extest.microsoft.com
CALLBACK MESSAGE: SyncAll Finished.
SyncAll terminated with no errors.

Syncing partition: CN=Configuration,DC=SG2TDSO1000094D,DC=extest,DC=microsoft,DC=com
CALLBACK MESSAGE: The following replication is in progress:
    From: 9aaeaf75-2fdf-48a1-8bea-00c6d2d110bd._msdcs.SG2TDSO1000094D.extest.microsoft.com
    To  : b36c1250-bbd1-44c1-a74a-ca121ab8e538._msdcs.SG2TDSO1000094D.extest.microsoft.com
CALLBACK MESSAGE: The following replication completed successfully:
    From: 9aaeaf75-2fdf-48a1-8bea-00c6d2d110bd._msdcs.SG2TDSO1000094D.extest.microsoft.com
    To  : b36c1250-bbd1-44c1-a74a-ca121ab8e538._msdcs.SG2TDSO1000094D.extest.microsoft.com
CALLBACK MESSAGE: SyncAll Finished.
SyncAll terminated with no errors.

Syncing partition: DC=SG2TDSO1000094D,DC=extest,DC=microsoft,DC=com
CALLBACK MESSAGE: The following replication is in progress:
    From: 9aaeaf75-2fdf-48a1-8bea-00c6d2d110bd._msdcs.SG2TDSO1000094D.extest.microsoft.com
    To  : b36c1250-bbd1-44c1-a74a-ca121ab8e538._msdcs.SG2TDSO1000094D.extest.microsoft.com
CALLBACK MESSAGE: The following replication completed successfully:
    From: 9aaeaf75-2fdf-48a1-8bea-00c6d2d110bd._msdcs.SG2TDSO1000094D.extest.microsoft.com
    To  : b36c1250-bbd1-44c1-a74a-ca121ab8e538._msdcs.SG2TDSO1000094D.extest.microsoft.com
CALLBACK MESSAGE: SyncAll Finished.
SyncAll terminated with no errors.
```

