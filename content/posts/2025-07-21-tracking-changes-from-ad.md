---
date: 2025-07-21
title: '如何跟踪 AD 的 change'
template: post
thumbnail: '../thumbnails/sync.png'
slug: tracking-changes-from-ad
categories:
  - Tech
tags:
  - Reproduced
  - Active Directory
  - Microsoft
  - Windows Server
  - Server
  - Distributed System
  - Multimaster
  - Synchronization
---

# Key Takeaways

+ 有三种 track change 的方式：AD DC 主动通知、DirSync 从 DC 拉、USNChanged 从 DC 拉。不管对哪种方式，都需要注意：
  + 使用属性 `objectGUID` 来标识对象而不是 DN，即便 AD 系统中通过 DN 来标识对象，但是通过属性 `objectGUID` 对 track change 的应用程序来说可以更好地跟踪。
  + 根据属性 `isDeleted` 来正确找到被删除的对象。

+ DirSync 需要特别的高权限 `SE_SYNC_AGENT_NAME`，如果没有的话请考虑使用 USNChanged。
+ 这些东西需要存储在一起，以保证 data restore 之后我们拉的 identifier 仍然是一致的。
  + 从 DC 上同步的内容。
  + DirSync 的 cookie。
  + USNChanged 的值、绑定的 DC 相关的信息（DNS name、invocation id、DC name）。
+ 对 Notification 设置的 `Attributes` 只是用于对返回的对象上的属性集合进行限制，但要不要返回一个对象与设置的属性集合无关；对 DirSync 设置的 `Attributes` 则会被用于限制被返回的对象上，只有关心的这些属性被改过才会返回。

以下是正文。

# 跟踪 Active Directory 中的数据变化

有这么一些特定的场景必须维护存储在 AD 中某些特定数据与其他数据之间的一致性，这些其他的数据可能存储在 directory 目录服务中，也可能在 SQL server、file、注册表中。当存储在 AD 中的数据变化后，其他数据也需要按顺序作相应的变动来维持一致性。

需要注意的是，这里讲的跟踪变化不包含被监控应用 monitoring application 使用的机制。有些应用程序监控 directory 变更的目的不是为了在不同存储之间保持数据的一致性，而是将其作为一种系统管理工具。尽管这些监控的应用可以用我们之后要讲的、与支持变更跟踪的应用同样的机制，但以下机制是专门为监控应用程序设计的：

+ Security auditing 安全性审计。通过修改对象安全描述符的系统访问控制列表 （system access-control list (SACL)） 部分，可以使得在访问指定 DC 上的对象时，会在该 DC 上的安全事件日志 security event log 中生成审核记录 audit records。应用可以审计读取和/或写入；也可以审计整个对象或特定属性。

+ Event logging 事件日志。通过修改指定 DC 上的注册表设置，可以更改记录到 directory service event log 中的事件类型。更具体地说，如果想记录所有的修改操作，可以将以下注册表项下的 `8 Directory Access` 值设置为 `4`。
  ```
  HKEY_LOCAL_MACHINE.SYSTEM.CurrentControlSet.Services.NTDS.Diagnostics
  ```

+ Event tracing 事件跟踪。Windows 2000 引入了事件跟踪的 API，用于跟踪和记录软件或硬件中的相关 event。尤其是 Windows 操作系统和 Active Directory Domain Services，支持使用事件跟踪进行容量规划 capacity planning 和详细的性能分析。

## Overview of Change Tracking Techniques

#### Considerations

跟踪变更的机制在这些方面有所不同。

+ **Scope**：一个应用可能只想跟踪单个对象的单个属性的变更，另一个应用可能关心一个 domain 中的所有对象。如果这种变更的机制可以满足应用的需求，那么应用就可以只接受最少的无关数据，从而提升性能。
+ **Timeliness**
  + 一个应用可以在每次发生变化后立刻通知，也可以在几分钟～几小时后收到变化的 net effect 净影响。
  + 处理更少的及时的数据可能更有效，因为多个变更可能会被合并为一个。例如，如果一个属性在一个小时的时间间隔内变了三次，那么一个选择一小时通知所有累计的变更的应用，只会收到一次属性的变更，而不是三次。
  + 当考虑及时性的时候，也需要考虑 replication latency 的影响。发生在一个 DC 上的更新并不会立刻被 replicate 到另一个 DC 上。因此，要求在跟踪时的及时性远优于预期的 replication latency 通常不会给应用带来真正的益处。<u>*（注：说人话就是过度追求及时性、甚至要求它高于 replocation latency 是不现实的）*</u>
+ **Polling VS Notification**
  + 当使用 polling 轮询时，一个应用通常周期性地给 DC 发请求来获取变更数据；而使用 notification 通知时，DC 会在变更发生时主动把变更发给应用。
  + 轮询的开销是显而易见的，应用程序可能会在没有事件发生的情况下仍发送请求来获取变更的数据；通知的开销则更为微妙，DC server 必须自身维护一份关于通知请求的数据，并根据这些数据来决定是否发送具体的通知，这可能会增加 AD 系统中一个正常更新请求的开销。
+ **Expressing the application's knowledge**
  + Persistent VS temporary：每一种跟踪变更的机制都必须包含一种方法，以便于让保存被跟踪数据的服务器知道应用的已知状态，这样才能定义哪些东西是「变更」。举个例子，应用的已知状态可能被表达为「在时间 t 之前发生在 DC d上的所有变更」。一种基于这样的已知状态的机制就可以有效地让应用获取在指定时间后发生的变更。
  + 如果这样一种应用的已知状态可以被持久化，（即可以被恢复地存储，比如在文件系统或者数据库中，）相比它不能被持久化的情况而言，应用重启所需的资源会更少。在上面的例子中，应用的已知状态可以通过记录 DC `d` 和时间 `t` 被持久化。一些变更通知的机制不允许这些数据被持久化。当应用程序启动时，服务器和应用程序必须用一些其他的机制同步。如果涉及多个对象，这将耗费大量资源，而且可能涉及复杂的编程。

#### Technologies

在 Active Directory Domain Services 中有三种方法来跟踪变更，并会在后续篇章逐一介绍。

+ 使用 change notification control 变更通知控制初始化一个持久化的异步搜索来获得符合特定 filter 的变更。
+ 使用 directory synchronization（DirSync）搜索来获得自从上一次 DirSync 搜索后发生的变更。
+ 使用属性 `USNChanged` 来搜索自从上一次搜索后发生变更的 objects 对象。

#### Comparisons

适合 change notification control 的应用是那些监听不频繁变更的数据、并且需要被合理地及时通知的应用或服务。一个例子是存储了 AD server 上的配置数据，这样的应用程序必须在变更发生后被立刻通知。它有如下这些限制：

+ 通知的及时性取决于 replication latency 和变更在哪里发生的。当变更 replicate 到我们正在监控的副本上时，我们就会立刻收到通知，但其实这个变更可能更早发生在其他副本上。<u>*（注：如果有 replication delay，那么通知就是会被 delay）*</u>
+ 他只能监听单个 object 或者一个 container 的直接子对象。如果需要监听多个 container 或者无关的对象，最多可以注册五个请求。
+ 如果有多个 client 在监听**频繁变更**的对象，这将会影响服务器的性能。基于 server 端性能的考虑，应用应当减少使用这种方法。如果不是必须立刻马上知道变更，更好的方式是周期性 poll change 而不是使用 notification。

DirSync 和 USNChanged 这两种方法是为了那些需要在 AD 数据和其他存储介质中的相对应的数据保持一致的应用设计的。这两种技术都需要应用周期性轮询获得变更的数据。DirSync 是基于 LDAP server control 的，可以通过 ADSI 或者 LDAP APIs 使用。但他的缺点包括：

+ DirSync control 只能在高权限账户下被使用，比如 domain 管理员。
+ DirSync control 只能监听一整个 NC，不能限制 scope，比如一个特定的 subtree、container、某个对象。

相比之下，USNChanged 相关的方法没有这些限制，尽管使用起来比 DirSync 复杂一些。

## Change Notifications in Active Directory Domain Services

Active Directory Domain Services 为客户端的应用程序提供了一种向 DC 注册以接收变更通知的机制。为此，客户端需要在异步 LDAP 的搜索中指定 LDAP change notification control。客户端还可以指定以下参数。 

| 参数       | 描述                                                         |
| ---------- | ------------------------------------------------------------ |
| Scope      | 使用 `LDAP_SCOPE_BASE` 来监视对象；使用 `LDAP_SCOPE_ONELEVEL` 来监视对象的直接子项，但不包括对象本身；不要使用 `LDAP_SCOPE_SUBTREE`。虽然如果 base object 是 NC 的 root 对象的情况下，scope subtree 是被支持的，但这样会严重影响服务器性能，因为每次 NC 中的对象被修改时，都会生成一条 LDAP 搜索结果的消息。此外，不能为任意子树指定 `LDAP_SCOPE_SUBTREE`。 |
| Filter     | 使用filter 比如 `(objectclass=*)` ，在指定范围内任何对象的变更都将收到通知。 |
| Attributes | 指定发生变更时要返回的属性列表。请注意，当任何属性被修改时都会收到通知，而不仅仅是指定的属性。<u>*（注：区分被监听的对象属性和返回结果的属性）*</u> |

在一个 LDAP connection 上最多可以注册五个 notification request。使用者必须有一个专门的线程来等待 notifcation 并快速处理结果。当调用 `ldap_search_ext` 方法来注册 notification request 时，该方法会返回一个标识该请求的消息标识符 message identifier。然后使用 `ldap_result` 方法来等待变更的通知。当变更发生时，服务器会发送一条 LDAP 消息，其中包含生成这条通知的 notification request 的 message identifier。这样，`ldap_result` 方法就会返回标识已被变更的对象的搜索结果。

客户端的应用程序必须决定被监控对象的初始状态。为此，必须首先注册 notification request，然后读取当前的状态。

客户端的应用程序还必须决定变更的原因。对 base level 的搜索，当任何属性发生变更、或者对象被删除或移动时，都会发出通知。对 one level 的搜索，当子对象被创建、删除、移动或修改，都会发出通知。请注意，如果被监听对象的层次结构上面的对象<u>*（注：更上层的 DN）*</u>被移动或重命名，不保证会有通知，即使我们被监听对象的 DN 也会因此被改变。例如，如果用户监控一个 container 中子对象的变更，那么 container 本身被移动或重命名将不会收到通知。

客户端处理搜索结果时，可以使用方法 `ldap_get_dn` 来获取被变更过的对象的 DN。**不要依赖 DN 来识别被跟踪的对象，因为 DN 可能也会被变更。**相反，正确的做法是在要检索的属性列表中包含属性 `objectGUID`。无论对象在 forest 中被移动到哪里<u>*（注：重命名也是一种移动）*</u>，它的属性 `objectGUID` 都保持不变。

如果一个在搜索范围内的对象被删除，客户端会收到 change notification，并且对象的属性 `isDeleted` 会被设为 `TRUE`。在这种情况下，搜索结果会显示这个对象的新 DN 在其分区 partition 的 `Deleted Objects container` 中。不需要使用 tombstone control (`LDAP_SERVER_SHOW_DELETED_OID`) 来获取对象被删除时通知。

在客户端注册 notification request 后，将继续收到通知，直至连接中断或客户端调用方法 `ldap_abandon` 主动放弃搜索。如果客户端或服务器断开连接，例如 server  fail，notification request 就会终止。当客户端重新连接时，必须再次注册 notification，然后读取感兴趣的对象的当前状态，以避免在客户端断开连接的这段时间发生过任何变更。<u>*（注：避免漏 change）*</u>

客户端可以使用对象属性 `uSNChanged` 上的值来决定服务器上对象的当前状态是否反映了客户端收到的最新变更。当对象被移动或变更时，系统会对对象的属性 `uSNChanged` 赋一个更大的新值。举个例子，如果服务器发生故障，directory partition 从备份中恢复，服务器上对象的副本可能不能反映出之前<u>*（注：从副本中 restore 前）*</u>已经报告给客户端的变更，在这种情况下，服务器上的 `uSNChanged` 值将低于客户端存储的值。

## Polling for Changes Using the DirSync Control

Active Directory directory synchronization（DirSync）control 是 LDAP 服务器的一个 extention，它使应用程序能够在 directory partition 中搜索自上一个状态以来变更的对象。

当进行一次 DirSync 搜索时，需要传入一个应用相关的数据 cookie，用它可以标志上一次 DirSync 搜索时的 directory 状态。对于第一次搜索，传入的 cookie 是 `null`，搜索结果将返回与筛选条件匹配的所有对象。搜索还会返回一个有效的 cookie。应用需要将 cookie 存储在与 Active Directory 服务器同步的同一存储介质中<u>*（注：其实就是保存下来之后能读到，并且能够保证跟 sync 的数据一致/同步就行）*</u>。在后续搜索中，从该存储中获取 cookie 并将其与新的搜索请求一起发给 AD。返回的搜索结果将仅包含自 cookie 标识的上一个状态以来变更过的对象和属性。搜索还会返回一个新的 cookie，这样存储起来可以供下次搜索时使用。

下表列出了客户端搜索请求可指定的搜索参数。

| 参数               | 描述                                                         |
| ------------------ | ------------------------------------------------------------ |
| Base of the search | 必须是 directory partition 的 root，可以是 domain/configuration/schema partition。 |
| Scope              | 必须是 `ADS_SCOPE_SUBTREE`，即 partition 的整个子树。<u>*（注：不支持 `LDAP_SCOPE_BASE/LDAP_SCOPE_ONELEVEL`）*</u>注意：如果搜索的是 domain partition，那么被搜索的子树包含 configuration/schema partition 的 heads 头，但是不包含内容。<u>*（注：就是说即便这两个 NC 逻辑上挂在 domain NC下，DirSync 也不会同步这两个分区的具体更改。这跟三个 NC 互相独立被 replication 是一样的。）*</u>如果需要一个更小的 scope，请使用 USNChanges 而不是 DirSync。 |
| Filter             | 可以使用任何有效的 filter。对第一次 `null` cookie 的初始化搜索来说，结果包含所有满足 filter 的对象。对后续有序的 cookie 的搜索来说，结果包含所有满足 filter 并自从 cookie  暗示的状态以来变更过的对象。 |
| Attributes         | 可以指定在变更发生时要返回的属性列表。对任意对象，初始搜索的结果包括对对象设置的所有的请求的属性集合。后续搜索的结果**仅包含在这些指定属性子集范围中变更过的属性，未被变更的属性不会被包含在搜索结果中**。在 ADSI 的实现中，搜索结果始终包含每个对象的 `objectGUID` 和 `instanceType`。此外，这里指定的属性列表相当于一个额外的 filter：初始搜索结果仅包含至少具有指定属性集合之一的对象； 后续的搜索仅包括一个或多个属性变更过的对象（添加或删除值）。 |

同时，需要注意：

+ 对增量搜索而言：
  + 最佳实践是始终使用/绑定上一次搜索中使用的 DC，即生成 cookie 的 DC。如果它不可用，要么等待它重新变得可用，要么绑定到一个新的 DC 并进行 full sync。将 DC 的 DNS name 与 cookie 一起存储下来。
  + 可以将一台 DC A 产生的 cookie 传给另一台不一样的 DC B，如果它和原来那一台 DC A 在同一 directory partition 上互相 replicate。客户端不会因为在另一个 DC B 上使用来自 DC A 的 cookie 而丢失任何变更。尽管如此，但是，来自新 DC B 的搜索结果可能包括旧 DC A 已经报告的变更<u>*（注：因为 cookie 中标识各个 DC 的水位线只有一个值）*</u>；在某些情况下，新 DC 可能会返回所有对象和属性，就像 full sync 一样<u>*（注：比如新 DC 不在旧 DC 的 UTDV 中，cookie 中也就没有新 DC 的水位线，只能重头 full sync）*</u>。
+ 新的 DC 也有可能拒绝从旧 DC 返回的 cookie。
  + 搜索会在服务器上产生一个 LDAP error 比如 `0000203D: LdapErr: DSID-xxxxxxxx, comment: Error processing control, data 0`，客户端的应用程序可能产生一个 error 比如 `System.DirectoryServices.Protocols.DirectoryOperationException: A protocol error occurred.`。
  + 举例来说，当 cookie 太老并且 cookie 的内部内容在由运行不同版本 Windows 的 LDAP 服务器处理会有所不同时，就可能发生这种情况。
  + Cookie 有着不透明的结构，不能保证 cookie 的结构在所有的 Windows 版本上都保持一致。应该由客户端的应用程序来处理这种情况，并且在遇到这种 error 时通过 full sync 来重试。
+ 当一个对象被重命名或移动时，它的子对象（如果有的话）将不被包括在搜索结果中，即使子对象的 DN 已经发生了变化。类似地，当对象安全描述符 object security-descriptor 中可继承的 ACE 被修改时，搜索结果中也不会包含该对象的子对象，即使子对象的安全描述符已经被变更。
+ 使用 `objectGUID` 属性来识别被跟踪的对象。无论对象在 forest 中被移动到哪里，它的 `objectGUID` 都保持不变。
+ 请注意，DirSync 搜索结果表示的是在搜索这个时刻上，directory partition 上当前这个副本 replica 上对象的状态。这意味着，如果其他 DC 上的变更没有被复制到应用程序搜索发生的这台 DC，这些变更将不会被包括在结果中。这还意味着，自上次 DirSync 搜索以来，对象的属性可能已被变更多次，但这次搜索只会显示最终的状态，而不是变更的序列。
+ 在 ADSI 实现中，应用程序必须将 cookie 作为一整个不透明来处理，不能对其内部的组织结构 organization 或值 value 做出任何假设。
+ 请注意，客户端应该将 DC 的 cookie、cookie 长度和 DNS name 存储在与包含被同步对象数据的同一存储中。这可确保在从备份恢复存储时，cookie 和其他参数仍然与对象的数据保持同步/一致。
+ 如果要检索为 DirSync control 构建的属性 `parentGUID`，还需要请求属性 `name`。

为了使用 DirSync control，使用者必须在被监控的 partition 的 root 上有着权限 `directory get changes`。默认情况下，该权限被分配给 DC 上的 Administrator 和 LocalSystem 账户。使用者还必须拥有权限 `DS-Replication-Get-Changes extended control access`。有关为必须在无此权限的账户下运行的应用程序实施变更跟踪机制的更多信息，请参阅使用 USNChanged 轮询变更。

#### Retrieving Deleted Objects With a DirSync Search

`ADS_SEARCHPREF_DIRSYNC` 搜索结果会自动包含与指定搜索过滤器匹配的已删除对象（tombstones）。但是，一个对象如果在存活时与一个 filter 匹配，在它被删除后则可能不再匹配。这是因为 tombstones 只保留了原始对象的部分属性子集。

举个例子，对于 user 对象，通常会使用 filter：`(&(objectClass=user)(objectCategory=person))`。可是属性 `objectCategory` 会在对象被删除时被移除，因此上述 filter 不会匹配任何 tombstones 对象。相反，tombstones 对象会保留 `objectClass` 属性，因此 filter `(objectClass=user)` 可以匹配被删除的 user 对象。

在 DirSync 搜索中指定的属性列表也可用作 filter；搜索结果只包括自上次 DirSync 搜索以来指定属性集合中一个或多个属性发生变化的对象。如果属性列表不包括 tombstones 上保留的任何属性，搜索结果将不包括 tombstones 对象。为了处理这种情况，可以通过指定一个空属性列表来请求所有的属性；也可以请求属性 `isDeleted`，它在所有 tombstones 上被设为 `TRUE`。tombstones 的属性 `searchFlags` 也将 `0x8` 位设为了 TRUE，这个属性来自 `attributeSchema` 的定义。

## Polling for Changes Using USNChanged

DirSync control 功能强大并且效率高，但有两个明显的局限性：

+ 仅适用于高权限的应用程序：为了使用 DirSync 控制，应用程序必须在 DC 上具有 `SE_SYNC_AGENT_NAME` 权限的账户下运行。很少有账户具有如此高的权限，因此普通用户无法运行使用 DirSync control 的应用程序。
+ 不能限制子树的范围：DirSync control 会返回 NC 中发生的所有变更。如果一个应用程序只对 NC 中的的一个小子树中发生的变更感兴趣，就必须浏览许多并不相关的变更，这对应用程序和 DC 来说都是低效的。

可以通过查询属性 `uSNChanged` 来获取 Active Directory 中的变更，从而避免 DirSync control 的这些限制。这种替代方法并非在所有方面都优于 DirSync 控件，因为不管是任何属性发生变化，它都会传输所有属性<u>*（注：而不是 DirSync 的特定属性集合）*</u>；此外，他也需要应用程序的开发人员做更多工作来正确处理某些故障情况。目前，它是编写某些变更跟踪的应用程序的最佳方法。

当 DC 修改一个对象时，它会将该对象的属性 `uSNChanged` 设置为一个新的更大的值，该值大于该 DC 上所有其他对象的属性 `uSNChanged` 上的值。因此，应用程序可以通过查找具有最大 `uSNChanged` 值的对象，找到 DC 上最近被变更过的对象。DC 上最近第二次被变更的对象将具有第二大的 `uSNChanged` 值，依此类推。

属性 `uSNChanged` 是不可复制的，因此在两个不同的 DC 上读取同一个对象的属性 `uSNChanged` 通常会得到不同的值。

例如，属性 `uSNChanged` 可被用于跟踪子树 S 中的变化。首先，对子树 S 执行一次 full sync，假设 S 中所有对象的最大 `uSNChanged` 值为 `U`。定期查询子树 S 中 `uSNChanged` 值大于 `U` 的所有对象，这样的查询将返回自 full sync 以来变更过的所有对象。将 `U` 赋值更新为这些已变更对象中最大的 `uSNChanged` 值，然后就可以再次轮询了。

实现一个基于 `uSNChanged` 同步的应用程序的细节包括：

+ 使用 rootDSE 的属性 `highestCommittedUSN` 来绑定基于 `uSNChanged` 的 filter。
  + 也就是说，在开始一次 full sync 前，需要先读取 affiliated DC 上的 `highestCommittedUSN`。然后，执行一次 full sync（结果可能很多，需要分页）来初始化数据库。当这完成后，存储 full sync 前读取的 `highestCommittedUSN` 值，它将作为下一次同步的属性 `uSNChanged` 的下限。
  + 之后，在执行增量同步时，请重新读取rootDSE 上的属性 `highestCommittedUSN` 。然后使用上次 sync 完保存的 `uSNChanged` 值，来分页读取相关对象，这些对象的属性 `uSNChanged` 都比 filter 中的值大。完成后，用在增量同步开始之前读取的 `highestCommittedUSN` 值更新属性 `uSNChanged` 属性的下限。<u>*（注：原文没有提及上限，万一 DC 已经 replcaite 了新的 change，`highestCommittedUSN` 被更新为更大的值了怎么办？看 [demo code](https://learn.microsoft.com/en-us/windows/win32/ad/example-code-to-retrieve-changes-using-usnchanged)，被记录的 `highestCommittedUSN` 确实是在搜索前被更新，搜索实际使用的是根据上一次 usn 构造的 `iLowerBoundUSN`。理论上这样也不会丢 change，只是下一次返回的结果里面可能有上一次已经处理过的结果而已，更需要应用在处理时仔细小心。）*</u>
  + 始终将这两个东西存储在同一存储中：属性 `uSNChanged` 下限的这个值、应用程序从 DC 同步的内容。
+ 由于属性 `uSNChanged` 是不可复制的，应用程序每次运行时都必须绑定到同一个 DC 上。如果无法与该 DC 绑定，要么等待直到可以重新绑定为止，要么换一台 DC 关联并从新 DC 上面执行一次 full sync。当应用程序关联到某个 DC 时，它会在一个稳定的存储介质中记录该 DC 的 DNS 名称，这个存储介质与从 DC 同步的数据保持一致。然后，它会使用存储下来的 DNS 名称来绑定到同一 DC ，以进行后续的同步。
+ 应用程序必须检测当前关联的这台 DC 何时从备份中恢复，因为这可能导致不一致 inconsistancy。
  + 当应用程序关联到某个 DC 时，它会将该 DC 的 invocation id 持久化存储下来，这个存储即应用程序从 DC 同步的内容的存储。DC 的 invocation id 是一个 GUID，它存储在 DC service object 的属性 `invocationID` 中。如果需要获取 DC service object 的 DN，可以读取 rootDSE 的属性 `dsServiceName`。
  + 请注意，当应用程序的持久化存储从备份中恢复时，不会出现一致性问题，因为 DC name、invocation id 和属性 `uSNChanged` 值的下限都和与 DC 同步的内容存储在一起。
+ 不管是 full sync 还是增量 sync，都请使用分页，以避免在同时获取很大结果集合的可能性。
+ 在使用分页时，使用基于索引的查询来避免 server 端存储大量中间结果。
+ 一般来说，不要使用 server 端对搜索结果进行排序，因为这样会迫使服务器对大量中间结果进行存储和排序。这同样都适用于 full sync 还是增量 sync。
+ 优雅处理 no parent 的情况。应用程序可能会在收到一个对象的父对象之前就收到对该象。根据应用程序的不同，这可能是问题，也可能不是问题。应用程序始终可以从 directory 中读取父对象的当前状态。
+ 为了处理被移动或被删除的对象，需要存储每个被跟踪对象的属性 `objectGUID`。无论对象在整个 forest 中被移动到哪里，它的属性 `objectGUID` 都不会改变。
+ 为了处理被移动的对象，要么定期执行 full sync，要么增加搜索的范围并在客户端过滤掉不感兴趣的变更。<u>*（注：这里指的应该是对象被移出了当前监听的 scope，所以不会再被返回。）*</u>
+ 为了处理被删除的对象，要么定期执行 full sync，要么在执行增量 sync 时单独搜索已被删除的对象。在查询被删除对象时，可以通过被删除对象的属性 `objectGUID` 来确定哪些对象需要从数据库中删除。
+ 请注意，搜索结果只包括使用者有权限读取的对象和属性（基于各种对象上的安全描述符 security descriptors 和 DACLs）。

## 来源

+ [Tracking Changes](https://learn.microsoft.com/en-us/windows/win32/ad/tracking-changes)
+ [Change Notifications in Active Directory Domain Services](https://learn.microsoft.com/en-us/windows/win32/ad/change-notifications-in-active-directory-domain-services)
+ [Polling for Changes Using the DirSync Control](https://learn.microsoft.com/en-us/windows/win32/ad/polling-for-changes-using-the-dirsync-control)
+ [Example Code Using ADS_SEARCHPREF_DIRSYNC](https://learn.microsoft.com/en-us/windows/win32/ad/example-code-using-ads-searchpref-dirsync)
+ [Polling for Changes Using USNChanged](https://learn.microsoft.com/en-us/windows/win32/ad/polling-for-changes-using-usnchanged)
+ [Example Code to Retrieve Changes Using USNChanged](https://learn.microsoft.com/en-us/windows/win32/ad/example-code-to-retrieve-changes-using-usnchanged)
