---
date: 2024-08-31
title: '作为 AD 初学者的学习笔记'
template: post
thumbnail: '../thumbnails/active-directory.png'
slug: study_notes_as_ad_beginner
categories:
  - Tech
tags:
  - Active Directory
  - Server
  - Database
  - Distributed System
  - Multimaster
  - Replication
---

## 写在 25.07.22

这篇问答原文整理自 24 年八月刚 reorg 完开始接触 AD、参加 ramp-up sessions 和看 recording 时产生的一些疑问，有些是问 ChatGPT 的（格式比较规矩的中文甚至还有 emoji 🫶🏻），有些是请教同事和 TL 的（比较随意的英文 😅）。现在是 2025 年 7 月，回头看这些都是些零碎知识点，但也算是成长的一部分吧 🫨。

当然，还是强烈推荐阅读这本书 [《Active Directory, 5th Edition》](https://learning.oreilly.com/library/view/active-directory-5th/9781449361211/)，很多内容在书里都有更系统的介绍。用 ChatGPT 了解新东西作为 starter 挺好的，但要深入理解还是看书更容易建立体系。主要是从本人现在的知识域来说，有些地方它说得也不太准确，比如 CNF 对象的冲突解决、特殊字符的使用等。本来想着就这样吧，等以后写读书笔记再好好写吧，但是难受一天，还是决定不要把错误信息留在语料库里污染世界了哈哈哈 🥺。

## Q: AD objects are stored in a form of folders? 

> AD 使用树状结构来组织和管理目录中的对象。这种结构帮助在网络中创建清晰的层次关系和组织框架。
>
> **目录树（Directory Tree）**：
>
> - AD 的数据结构是一个分层的树状结构，其中每个节点代表一个对象，如用户、计算机、组或组织单位（OU）。
> - 根节点通常是整个域，树的其他部分包括域中的组织单位和对象。
>
> **根节点**：
>
> - AD 的根节点是整个目录树的起点。在一个 AD 林（forest）中，根节点通常是森林根域（forest root domain）。
> - 在单个域的情况下，根节点是该域本身。
>
> **域（Domain）**：
>
> - 一个域是 AD 结构中的基本单位，用于组织和管理网络资源。
> - 域可以看作是目录树的一个分支，每个域有自己的目录数据和对象。
>
> **组织单位（Organizational Units，OU）**：
>
> - 组织单位是域中的容器，用于进一步组织和管理对象。它们可以嵌套在其他组织单位中，形成更深层次的树状结构。
> - OU 允许管理员应用组策略（Group Policy）和分配权限，而不影响整个域中的所有对象。
>
> **对象（Objects）**：
>
> - 目录中的每个节点都是一个对象。对象可以是用户、计算机、组、打印机等。
> - 每个对象都有一个独特的 DN（Distinguished Name），用于唯一标识它在树中的位置。

## Q: Is Domain the same as Tenant?

> 在 Active Directory (AD) 的术语里，**Domain ≠ Tenant**，但它们之间存在一定的相似性，在某些上下文中（比如多租户架构或 Azure AD）会出现映射关系。不过在原生 AD 中，它们是两个**不同的概念**：
>
> ------
>
> ## 🧾 一句话对比
>
> | 概念       | 所属系统              | 含义                                      |
> | ---------- | --------------------- | ----------------------------------------- |
> | **Domain** | Active Directory      | 安全边界 + 管理边界，承载对象如用户/组/OU |
> | **Tenant** | Azure AD 或多租户系统 | 表示逻辑上独立的租户，类似一个公司/组织   |
>
> ------
>
> ## 🧩 Active Directory 中的 Domain
>
> - 是 AD 的**核心逻辑单位**，每个 Domain：
>
>   - 有自己的 **用户、组、计算机对象**
>   - 有 **唯一的域名**（如 `corp.example.com`）
>   - 是一个 **安全边界**（比如 GPO、权限）
>   - 有一套自己的 FSMO 域角色（如 RID Master）
>
> - 一个 AD Forest 可以包含多个 Domain：
>
>   ```
>   Forest: contoso.com
>   ├── Domain: corp.contoso.com
>   └── Domain: dev.contoso.com
>   ```
>
> ------
>
> ## 🏢 “Tenant”的语义
>
> ### 1. **在 Azure Active Directory (Azure AD)** 中：
>
> - **Tenant** 是指每一个 Azure 组织租户：
>   - 拥有一组用户、组、应用、策略
>   - 对应唯一一个域名（如 `contoso.onmicrosoft.com`）
>   - 是完全隔离的逻辑边界
>
> ### 2. **在多租户服务系统中**（比如 SaaS 服务）：
>
> - Tenant 通常代表一个客户或组织单位。
> - 每个 tenant 的数据和身份是隔离的。
>
> ------
>
> ## ✅ 总结
>
> | 问题                        | 回答                                           |
> | --------------------------- | ---------------------------------------------- |
> | Domain 是 tenant 级别的吗？ | ❌ 不是，Domain 是 AD 的逻辑边界，不等于 tenant |
> | 在 Azure AD 中呢？          | ✅ Azure AD 中的 tenant 概念类似“全域 Domain”   |

## Q: Why there are tables, SecurityDescriptor/object/link/link history?

> The tables are used for storing the actual AD data. Although AD looks like a tree, but the actual storage is still table. Different properties might be stored in different tables. 

## Q: Where are the three tables? Still on AD machines?

> Yes, AD's underlying storage is Jet DB and data is organized in tables.

## Q: Why table link history is related to Exchange Online scenario? Isn't it AD replication specific domain knowledge?

> There are actually 5 tables in AD, stored in `NTDS.dit`. Object/Link/LinkHistory/SecurityDescriptor/Index.
>
> + Object
>   + Store all records. DN(DistinguishedName)-style link is a property in a row.
>   + DNT is the key of a row and it has Parent DNT as well.
>   + `msExchOURoot` is most likely a DN-style link since we don't have index for it.
> + Link
>   + Store all Non-DN style links.
>   + Index would be built for links.
> + LinkHistory
>   + It used to store change history of a specific property, but it's no longer used now...
> + Index
>   + Just be used to build the indices.

## Q: Why `CN=, DC=, ...` Why some are CN and others are DC? What's the meaning in practice?

> This is used to represent the DN (Distinguished Name, like `CN=John Doe,OU=Users,DC=example,DC=com`.
>
> + **CN**（Common Name）: John Doe - 表示用户对象的名称。
> + **OU**（Organizational Unit）: Users - 表示对象所在的组织单位.
> + **DC**（Domain Component）: example 和 com - 表示对象所在的域。
>
> DN 是用于唯一标识目录对象的位置和层次结构的字符串。DN 描述了对象在目录树中的路径，从根节点一直到对象本身。DN 由一系列的相对专有名称（RDN，Relative Distinguished Names）组成，这些 RDN 通过逗号分隔。RDN 描述了对象在其父容器（或组织单位）中的唯一标识。一个完整的 DN 包括从根节点到目标对象的所有 RDN。例如，`CN=John Doe` 是 John Doe 用户对象的 RDN。RDN 由属性名称和值组成，例如 `CN` 是属性名称，`John Doe` 是属性值。

## Q: DomainController is the AD server in Substrate, right? These machines are both servers to handle the requests and servers to store the AD database.

> Yes

## Q: What's NamingContext Unit? SchemaNC/ConfigNC/DomainNC?

> 命名上下文，也称为目录分区，是 Active Directory 数据库中的一个**逻辑分区**。每个命名上下文包含特定类型的目录信息。主要的命名上下文有以下几种：
>
> 1. **Schema NC（架构命名上下文）**：Schema NC contains all the schema objects that define **how data is structured and represented** in Active Directory. DC 之间 replicate 的时候如果 Schema NC mismatch，会抛异常优先 replicate schema 相关的信息，match 了才会 sync 别的 object。
>
>    ```ini
>    Dn: CN=Schema,CN=Configuration,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com
>    ```
> 2. **Configuration NC（配置命名上下文）**：Configuration NC contains forest-wide configuration data such as the **site topology objects** and objects that represent naming contexts and application partitions
>
>    ```ini
>    Dn: CN=Configuration,DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com
>    ```
> 3. **Domain NC（域命名上下文）**：包含有关特定域的信息。包括域内所有用户、计算机和组等对象。
>
>    ```ini
>    Dn: DC=SG2TDSO100009ED,DC=extest,DC=microsoft,DC=com
>    ```
>
> 这些命名上下文在 AD 中相互独立，但它们之间的变化通过复制被传播到所有相关的域控制器上，以确保目录数据的一致性和可靠性。
>
> 不同的 NC 代表不同的目录分区，即使它们可能看起来因为 RDN 有层级关系，但是实际上平级。比如 Schema NC `CN=Schema,CN=Configuration,DC=example,DC=com` 本身是一个独立的 NC，并不是 Config NC `CN=Configuration,DC=example,DC=com` 的直接子级。

## Q: What's non-link/link attributes? Aren't link relationships for objects?

> Link attribute/property is stored in table Link instead of table Object. For example, DN (in SchemaNC) `CN=Member,CN=Schema,CN=Configuration,DC=USWTDSJ0000000D,DC=extest,DC=microsoft,DC=com` is a link attribute, it has metadata `linkId: 2` and `isSingleValued: FALSE `. 
>
> For example, DN (in DomainNC) `CN=Information Protection,OU=USWTDSJ0000000De15.o365.exchangemon.net,OU=Microsoft Exchange Hosted Organizations,DC=USWTDSJ0000000D,DC=extest,DC=microsoft,DC=com` has an attribute called member and the value is `CN=Administrator,OU=USWTDSJ0000000De15.o365.exchangemon.net,OU=Microsoft Exchange Hosted Organizations,DC=USWTDSJ0000000D,DC=extest,DC=microsoft,DC=com; ` which is another object.
>
> For replication: Non-link attribute means there are multiple value in this attribute, and would be replicated as blob, indicating extra overhead. 

## Q: What's link scenarios in real world? Tenants and users should be placed in some default order, right? Is this only used to impl v-team? 

> Not only for v-team. 
>
> + memberOf
> + showInAddressBook

## Q: The objects under one tenant look like shards (`TenantSettings_xxx`)? What's the relationship? Is SDS reading the data here?

> The objects under the tenant are recipients. They are definitely not the place where SDS stores the data, but SDS might rely on these as identifiers.

## Q: Replication ways: 

1. **Notification based**:
   1. **Originating** server
      1. put a WI in its notification list, 
      2. Iterate the list every 15s to avoid send the notifications too frequently and pack some changes, 
      3. invoke RPC calls to the list of remote DC; 
   2. **Target** server
      1. received the RPC call 
      2. and add WI to it's replication queue (Single thread per server), 
      3. handle the WIs starting from the one with highest priority,
      4. Current WI could be preempted and placed back if there is another WI with higher priority. 
   3. SchemaNC failure will block the ConfigNC and DomainNC by throwing schema mismatch error
   
2. **Schedule based**: 
   1. KCC will set the interval on an attribute called `Schedule` in the format of bitmap vector and one hour is represented to four bits.
   2. The minimal scheduled replication interval is 15 minutes 

3. **User triggered**: Cmdlet `repadmin`.

## Q: AD works as master/slave or all are equal candidates? Why affinity DC would be used if it's for load balancing? Wouldn't everybody want to read the latest correct data?

> Multiple master and all servers are equal.
>
> The affinity DC is determined by the client. The client specifies the desired DC when making the invocation. This is typically used in scenarios such as read-after-write, where consistency is important. For requests that don’t specify a DC, it's us to handle the selection to balance the load across servers.

## Q: AD Schema is not easy to be changed and can only be added new property instead of deleting, right? Where is schema be stored?

> Yes, since it needs to be deployed among the servers in all environments (by workflow) and it may take over 1 month. Forwards compatibility should be taken into considerations when changing the schema, so it should be very careful to change the schema and add a new property.
>
> The schema is stored in SchemaNC.

## Q: What does AD rebuild mean?

> AD 重建通常涉及恢复或重新配置域控制器、清理元数据、重新部署 AD 服务以及从备份恢复数据。这些操作旨在修复严重问题或在灾难性故障后恢复 AD 环境的正常运行。

## Q: What does it mean when object becomes tombstone after several days?

> When an object is deleted, it becomes tombstone to ensure all other DC servers could delete such objects to reach the eventual consistency among the AD forests. The timespan is 180 days usually, and the object could be deleted permanently after tombstone. This process is called garbage collection.
>
> The tombstone object could be recovered by ldp but most properties might be lost.
>
> The tombstone DN looks like `CN=CN=<Original Name>\0ADEL:<GUID>,CN=Deleted Objects,DC=example,DC=com`.

## Q: Why don't use the unique GUID to decide if it's the same object directly, in other words, resolving the conflict, comparing to check the name first in 8352 errors?

> Since the objects are indeed created on two DC and their GUID are different. The only effect part is their name which is the same due to retry from client side and distinguished name is actually the key instead of the GUID.

## Q: AD replication package is the same as implementing Sync Engine, right? So the AD server would have a remote replica id for the SE? 

> Yes, the replication package is the same. 
>
> AD server should only have remote replica id for other replica servers, and has no awareness of our sync engine. AD just return the following changes/replication packages based on USN.
>
> This behavior is a feature in the AD system. For more details on how to track AD changes, please refer to this [blog](/tracking-changes-from-ad/).

## Q: What if one server down and others don't have the latest replication packages? Just like the stale cookie cases, if the latest change is only stored on one server and this server down, is there any approaches to ensure this latest change could be read by other servers?

> Try to recover this machine... Since AD doesn't ensure the strict consistency, it's just eventual consistency. AD does not have a consensus algorithm and don't rely on the majority/quorum.

## Q: Tenant located on a specific BE, right? Why it's AF specific for the sync engine?

> Each AF has one DirSync tenant (name as `DirSyncSystemTenant_{AF alias}`) with multiple arbitration mailboxes (name as `{AF alias}_{data type}_{ObjectStore region}_{side}`) with specific capability (`OrganizationCapabilityDirSync`). The data of this tenant is stored in corresponding AF and there is only one such tenant per AF.
>
> Arbitration mailboxes could be queried by capacity and sync engine instances are relying on HA to orchestrate the mailboxes to random BEs then staring the engines there.

## Q: What's the difference for DC servers in AF/RF?

> DC in AF: Stores the configurations of tenants, works as SoT.
>
> DC in RF: Stores the forest data, will be used by HA to manage the forests, actually is not the SoT, HA uses them as cache.

## Q: CNF 对象是什么

> ## ✅ 什么是 CNF？
>
> > **CNF = Conflict**
> >
> > 它是 Active Directory 在 **多主复制中发生对象命名冲突** 时，
> > 系统自动添加的前缀，用来**保住两个冲突对象**，不直接覆盖任何一个。
>
> 你看到的类似：
>
> ```
> CN=User1\0ADEL:12345678-ABCD-EF12-3456-1234567890AB
> CN=Computer1\0ACNF:ABCDEF12-3456-7890-ABCD-1234567890AB
> ```
>
> 🧨 当你看到 `\0ACNF:` 的时候，说明：
>
> > ⚠️ **这个对象在复制过程中发生了命名冲突，AD 自动重命名它，保住它不丢**
>
> ------
>
> ## 🧠 什么场景会触发 CNF 对象？
>
> 最典型的是：
>
> ### ✅ 多个 DC 同时创建了同名对象
>
> 比如：
>
> - DC-A 在 `OU=Users` 里创建了 `CN=Alice`
> - DC-B 在同步前，也创建了一个 `CN=Alice`
> - 两者都有不同的 objectGUID、属性，但 DN 相同！
>
> 当它们互相复制时，AD 会发现：
>
> > 🚫 “啊哦，这俩 DN 一样，没法放一起！”
>
> ### 🧯 于是 AD 会：
>
> - ~~保留其中一个对象的原始 DN（如 DC-A 的）~~ 每个 DC 会按照特定的规则（VersionNumber、Timestamp、InvocationId）处理，这样可以保证所有的 DC 按照同样的规则处理后得到的结果是一样的，以达到最终一致。
> - 对另一个对象自动重命名为：
>
> ```
> CN=Alice\0ACNF:{GUID}
> ```
>
> - 并将其放入同一个容器下
>
> 🧠 这个叫 **Name Conflict Rename**，简称 **CNF 对象**
>
> ------
>
> ## 🧾 示例：
>
> 你可能看到：
>
> ```
> CN=Alice         ← 来自 DC-A，保留
> CN=Alice\0ACNF:12345678-9abc-def0-1234-56789abcdef0  ← 来自 DC-B，被重命名
> ```
>
> 两者都在 OU=Users 里，但名字不同。
>
> ------
>
> ## 🔍 CNF 是不是坏了？是不是脏数据？
>
> > ❌ **CNF 不是坏数据，也不是垃圾对象**
> > ✅ **它是 Active Directory 主动防止数据丢失的一种“冲突缓冲机制”**
>
> 它存在的意义是：
>
> - 保证 **冲突对象都保留下来**
> - 等待管理员手动判断：
>   - 哪个是对的？
>   - 哪个应该保留？
>   - 哪个可以删掉或合并？
>
> ------
>
> ## 📦 CNF 对象的特点
>
> | 属性         | 值                                                          |
> | ------------ | ----------------------------------------------------------- |
> | 自动重命名   | ✅ 带有 `\0ACNF:{GUID}` 后缀                                 |
> | 不可自动恢复 | ❌ 不会自动重命名回来                                        |
> | 会参与复制   | ✅ 会复制到所有 DC                                           |
> | 属性内容     | ✅ 保留所有原始属性                                          |
> | 权限/使用    | 🟡 正常 AD 查询能访问，但可能导致脚本/系统异常（因名称不同） |
>
> ------
>
> ## 🛠️ 怎么处理 CNF？
>
> 你可以：
>
> 1. 人工查清楚冲突来源
> 2. 比较两个对象的属性，看哪个需要保留
> 3. 手动：
>    - 重命名回去（如果还需要）
>    - 合并数据
>    - 删除多余 CNF 对象
>
> 💡 工具推荐：
>
> ```powershell
> Get-ADObject -LDAPFilter "(cn=*CNF*)" -IncludeDeletedObjects
> ```
>
> 或 GUI 中打开“Advanced Features”，手动清理
>
> ------
>
> ## ✅ 总结
>
> | 问题             | 答案                                        |
> | ---------------- | ------------------------------------------- |
> | CNF 是什么？     | **Conflict object**，表示复制时对象命名冲突 |
> | 什么时候出现？   | 多个 DC 创建了相同 DN 的对象                |
> | 是不是坏数据？   | ❌ 不是，是 AD 为防止数据丢失的机制          |
> | 需要手动处理吗？ | ✅ 通常需要管理员手动 review 和清理          |

## Q: `\0ACNF:` 和 `\0ADEL:` 这些出现在 DN/CN 里的特殊标记，AD 会不会当成保留字段，不允许用户输入？

> <u>*（注：基本正确，实践可以参考我这篇 [AD Object 命名规则的实践](/naming-practices-on-ad-objects)。）*</u>
>
> ## ✅ 简洁回答：
>
> > **Active Directory 不阻止用户人为创建包含 `\0ACNF:` 或 `\0ADEL:` 的 CN / DN**
> > 但在 AD 的内部解析中：
> >
> > ✅ 这些是特殊含义的标记
> > ❗如果你**手动创建冲突名**（尤其是 CNF 名），**可能会影响复制行为，甚至制造假冲突**
>
> ------
>
> ## 🧠 那它是怎么被识别出来的？
>
> 这两个关键标记都是 **由系统自动添加的 UTF-16 编码转义字符串**，专用于标记特殊对象状态：
>
> | 前缀            | 含义     | 出现场景                                                     |
> | --------------- | -------- | ------------------------------------------------------------ |
> | `\0ACNF:{GUID}` | Conflict | AD 复制时命名冲突导致的自动改名                              |
> | `\0ADEL:{GUID}` | Deleted  | 已删除对象进入 **Deleted Objects** 容器（tombstone）后的 DN 变名 |
>
> ------
>
> ## 🔧 字面解释：
>
> - `\0A` 是 UTF-16 中的**控制字符编码序列**
> - 它不是普通的 ASCII 字符串
> - 是一种特殊的「不可打印的控制分隔符」
>
> 因此虽然它在 **LDAP DN 字符串中可见为文字形式**：
>
> ```
> CN=Alice\0ACNF:{guid}
> ```
>
> 但 AD 内部处理时 **知道这是特殊含义**
>
> ------
>
> ## 🔐 那用户能手动创建包含 `\0ACNF:` 的名字吗？
>
> ✅ 技术上：可以
> ⛔ 实际上：非常不建议（可能带来副作用）
>
> 你可以通过：
>
> ```powershell
> New-ADUser -Name "Alice\0ACNF:1234"
> ```
>
> 或者直接 `ldifde` 加载
>
> 系统**不会强制拦截**（因为本质是普通字符串）
>
> 但是！
>
> > **这类对象在复制中可能被误识别为冲突对象、或被 replication 引擎跳过！**
>
> 因为：
>
> - 系统看到 `CN=XXX\0ACNF:{GUID}` 会认为是 conflict placeholder
> - 它会跳过重命名
> - 甚至拒绝覆盖导致“伪冲突”行为
>
> ------
>
> ## 🛡️ 为什么不禁止输入？
>
> 因为：
>
> - Active Directory 的对象命名规范（RFC 4514）允许绝大多数可打印字符
> - DN 是用户可控的
> - 不能禁掉所有有特殊含义的字符串（否则用户体验太差）
>
> 所以微软的做法是：
>
> > **允许输入，但系统内部做语义区分 & 冲突判断时使用完整逻辑（非只靠前缀字符串）**
>
> ------
>
> ## 🧨 最坏的情况会发生什么？
>
> 你手动造出：
>
> ```
> CN=Alice\0ACNF:{GUID}
> ```
>
> 之后：
>
> - 有其他 DC 真生成了 CN=Alice（冲突）
> - 系统判断：这两个对象都像 CNF 形式
> - 🤯 不知道谁是冲突源 → 可能不触发 rename → 冲突悬而未决！
>
> 或者：
>
> - 系统自动生成的 CNF 名字恰好和你手写的冲突
>    → 二次 CNF → `\0ACNF:...\0ACNF:...` → 出现怪异名字！
>
> ------
>
> ## ✅ 总结：
>
> | 问题                     | 答案                                                         |
> | ------------------------ | ------------------------------------------------------------ |
> | 用户能不能输入 `\0ACNF:` | ✅ 可以，技术上允许                                           |
> | 是否建议这么做？         | ❌ 不建议，极易制造复制冲突                                   |
> | 系统怎么识别这些？       | 按 UTF-16 编码、特殊语义字段识别，不靠文字匹配               |
> | AD 会限制它吗？          | ❌ 不会显式拦截，但可能产生副作用                             |
> | 最佳实践                 | ✅ 避免手动创建带 `\0ACNF:`、`\0ADEL:` 的名字，特别是 CN 字段！ |

## Q: AD multi master 为了什么？

> AD 的设计目的是在企业环境中提供高可用性和容错能力，但它并不使用多数一致性算法来保证强一致性。
>
> 1. **高可用性和低延迟**：
>    - AD 的设计侧重于高可用性和低延迟。多主复制模型允许任何 DC 处理更改，从而提高了系统的可用性和响应速度。
>    - 即使某个 DC 发生故障，其他 DC 仍然可以继续工作，从而提供较好的容错能力。
> 2. **最终一致性**：
>    - AD 保证最终一致性，即在没有新的更改的情况下，所有 DC 最终会达到一致状态。
>    - 这种方法适用于许多企业环境，因为大多数目录操作（如用户登录、查询等）不需要强一致性。

## Q: 为什么 AD 要 performs like a tree 但是底层存储其实仍然是 table 数据库呢？为什么要这么设计？当时有什么考量吗？

> ## 🌳 为什么 AD 逻辑上要表现为“树”？
>
> Active Directory 本质上是一个**目录服务（Directory Service）**，它主要面向**查询、组织、委派、安全控制和结构化数据的管理**。
>
> ### 树形结构的优势：
>
> | 目的             | 原因                                                         |
> | ---------------- | ------------------------------------------------------------ |
> | **反映组织结构** | 公司/组织/子组织、部门、人。天然层级，非常直观。             |
> | **授权委派**     | 某个 OU 下的权限可单独委派给某组管理员，天然分治。           |
> | **逻辑分割**     | 可按区域、功能、地理等划分命名空间。                         |
> | **兼容标准**     | 遵循 LDAP v3 标准，其规范定义了 DIT（Directory Information Tree）。 |
> | **支持继承**     | 权限、安全策略等可以从上层节点向下继承。                     |
>
> 👉 **逻辑树结构**更适合人类理解、使用与管理。
>
> ------
>
> ## 🧱 为什么底层实现仍然是表（table-like database）？
>
> AD 实际上使用的是一个高度优化的数据库引擎：**ESENT（Extensible Storage Engine）**，是一个**基于 B+ Tree 的页式存储表格数据库**，和传统的 SQL 不同，但本质是 key-value row-store 的一种变体。
>
> ### 表格存储的优势：
>
> | 目的             | 原因                                               |
> | ---------------- | -------------------------------------------------- |
> | **查询性能高**   | 按属性建立索引，性能优于树结构的遍历查找。         |
> | **变更效率高**   | 支持快速事务、页式写入、写前日志（WAL）。          |
> | **复制容易实现** | USN、元数据、行变更日志易于管理和复制。            |
> | **一致性强**     | 支持事务隔离、原子性、崩溃恢复。                   |
> | **扩展性强**     | 在不变更树结构的前提下，添加更多属性、索引很方便。 |
>
> 👉 **底层表结构**更适合机器处理、查询效率和一致性控制。
>
> ------
>
> ## 🧠 那为什么要“两套模型”？历史背景和设计考量：
>
> | 层面         | 决策                                           |
> | ------------ | ---------------------------------------------- |
> | 人类可理解性 | 采用“目录树”模型，适合管理员理解/操作。        |
> | 技术可实现性 | 用 ESENT 表格存储，保障性能与稳定性。          |
> | 遵循标准     | LDAP 协议需要树形的 DIT 结构来支持路径式访问。 |
> | 安全/委派    | 树结构天然支持 ACL/继承/分片授权。             |
> | 扩展性       | 数据库后端方便维护属性 schema、索引扩展等。    |
>
> > **一句话总结**：
> >  AD 是“前端是树，后端是表”的典型例子——既让人类好用，也让机器好做。
>
> ------
>
> ## 🔄 中间的桥梁：DIT to DB Mapping
>
> - 每个对象在数据库中是一个 row。
> - 树形结构的“层级”是由某些字段（如 `parentDNT`, `distinguishedName`, `objectClass`）来表示的。
> - ESENT 中有一个表叫 `datatable`，所有对象的属性都在里面。
> - 树状只是“逻辑视图”，**存储时所有对象是扁平化的**。
>
> ------
>
> ## 🎓 类似设计在哪些系统中出现？
>
> | 系统                | 逻辑结构   | 物理结构           |
> | ------------------- | ---------- | ------------------ |
> | AD                  | 树         | 表（ESENT）        |
> | Git                 | Commit DAG | 文件和 packfile    |
> | File System（NTFS） | 目录树     | MFT 表（记录条目） |
> | XML / JSON DB       | 树         | 字符串 + 索引表    |
> | Kubernetes          | YAML 层级  | etcd（键值对）     |
>
> 这是一种通用的工程折中：**逻辑上更具语义表达力、物理上更方便存储优化**。

## Q: AD 系统里有 single master 的 case吗？

>  对于某些关键任务，如架构更改、域添加或删除、RID 池分配等，AD 使用单主复制模型，由特定的 FSMO 角色（操作主机角色）承担这些任务。
>
>  ## 🧱 什么是 FSMO？
>
>  **FSMO（Flexible Single Master Operations）** 是 Active Directory 中的一组 **特殊角色**，用于处理 **不能通过多主复制（multi-master replication）处理的操作**。
>
>  虽然 AD 是一个 **多主架构**（即每台 DC 都可以读写），但有些操作 **必须有唯一权威源**，否则会产生冲突或破坏一致性。比如：
>
>  - 给对象分配唯一 ID
>  - 修改架构
>  - 设置域信任关系
>
>  这些操作由特定的 FSMO 角色承担。
>
>  ## 🖐️ 五个 FSMO 角色
>
>  FSMO 角色一共五个，分为两类：
>
>  ### 🔹 林级角色（Forest-wide，整个林只存在一个）：
>
>  | 角色名                   | 作用                                                    |
>  | ------------------------ | ------------------------------------------------------- |
>  | **Schema Master**        | 控制 Active Directory 架构的修改（新增对象类型/属性等） |
>  | **Domain Naming Master** | 负责添加/删除域（比如新增 child domain）                |
>
>  ### 🔸 域级角色（Domain-wide，每个域一个）：
>
>  | 角色名                    | 作用                                                   |
>  | ------------------------- | ------------------------------------------------------ |
>  | **RID Master**            | 分配 RID 池（用于对象 SID）给本域内的 DC               |
>  | **PDC Emulator**          | 模拟 NT4 PDC、处理密码变更、组策略、时间同步等关键任务 |
>  | **Infrastructure Master** | 处理跨域对象引用（如用户在组中引用到其他域的用户）     |
>
>  ## ❓是否是 Single Master？
>
>  是的，**每个 FSMO 角色在任何时候都只能有一个持有者**：
>
>  - 即便你有 100 个 DC，**Schema Master 永远只有一个**。
>  - 这是一种 “**单主架构**” 的机制，虽然 AD 整体是多主复制，但这些角色是单主。
>
>  ## 👑 FSMO 角色是怎么分配/决定的？
>
>  - **初始默认**：在你创建第一个 DC（即 Forest Root Domain）时，它默认拥有 **全部 5 个 FSMO 角色**。
>  - 你可以用工具或命令将 FSMO 角色 **转移（transfer）** 或 **强制接管（seize）** 到其他 DC：
>   - 图形界面（如 Active Directory Users and Computers）
>   - PowerShell 或 `ntdsutil`
>
>  ## ⚠️ 如果 FSMO 角色所在的 DC 挂了怎么办？
>
>  - **短期影响不大**：大部分日常操作不依赖这些角色。
>  - **长期需恢复或转移**：某些任务会失败，例如创建域、修改架构、创建用户（若 RID 用完）等。
>
>  你可以：
>
>  1. **恢复那台 DC（如从备份）**
>  2. 或者 **强制接管 FSMO（seize）** 到另一台 DC 上

## Q: What is RID Master?

> 它的全称是 **Relative Identifier Master**。它是每个 **域（Domain）** 特有的角色，负责分配 RID（Relative Identifier）池给该域中的其他域控制器（DC）。
>
> ### 🔧 什么是 RID？
>
> 在 AD 中，每个对象（如用户、计算机、组等）都必须有一个唯一的 **SID（Security Identifier）**，用于身份识别和权限控制。
>
> - 一个 SID 由两部分组成：
>
>   ```
>   SID = 域标识符（Domain Identifier） + RID（相对标识符）
>   ```
>
> - **域标识符** 是每个域唯一的，而 **RID** 是在该域中唯一的整数，由 RID Master 分配。
>
> ------
>
> ### 🧠 RID Master 的作用
>
> 1. **分配 RID 池给域内的其他 DC：**
>    - 每个域控制器本地维护一个 RID 池（例如一次拿到 500 个 RID），当它需要创建新的对象（比如新用户）时，就从本地池里分配一个 RID。
>    - 当 DC 的本地 RID 池快耗尽时，它会向 RID Master 请求新的 RID 范围。
> 2. **保证 RID 唯一性：**
>    - RID Master 是 RID 分配的唯一来源，防止多个 DC 分配出相同的 RID。
>
> ------
>
> ### 📍 RID Master 在哪里？
>
> - 每个域有一个 RID Master。
> - 它通常和 PDC Emulator（另一个 FSMO 角色）在同一台域控制器上。
>
> 你可以用 PowerShell 查看当前域的 RID Master：
>
> ```powershell
> Get-ADDomain | Select-Object RIDMaster
> ```
>
> ------
>
> ### 🔄 如果 RID Master 不可用会怎么样？
>
> - **短期问题不大**：因为每个 DC 都有本地 RID 池，不依赖实时请求。
> - **长期问题严重**：当本地 RID 池用完而不能联系 RID Master 请求新池时，DC 将无法创建新对象（比如新用户、新计算机账号等）。
