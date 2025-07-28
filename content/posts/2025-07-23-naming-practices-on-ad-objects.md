---
date: 2025-07-23
title: 'AD Object 命名规则的实践'
template: post
thumbnail: '../thumbnails/user.png'
slug: naming-practices-on-ad-objects
categories:
  - Tech
tags:
  - Active Directory
  - Practices
---

基于[前文](/study_notes_as_ad_beginner) ChatGPT 提到的如下理论，我实际测试了一下 AD 中的命名规则。首先，`CNF`、`DEL` 本身并不是 AD 的保留字或特殊字符，只有当它们和 [`\0A`](https://en.wikipedia.org/wiki/Control_character)（换行符） 一起使用时才有特殊含义。而根据实践，在这些 User 对象里面真正被限制的其实是字符 `\` 和 `:`，至于普通对象则并没有此类限制。

> Active Directory 不阻止用户人为创建包含 `\0ACNF:` 或 `\0ADEL:` 的 CN / DN

## User Object

#### 限制创建 DEL/CNF User Object 名称的特殊字符

可以看出 `:` 和 `\` 是被严格限制的字符，不能直接用于 CN 中。

![2025-07-23-special-chars](https://images.charlesfeng.cn/2025-07-23-special-chars.PNG)

#### 限制创建 User Object 名称的其他特殊字符

除了  `:` 和 `\` ， 我还测试了一些其他特殊字符，受限制的字符还包括 `*`、`=`、`+`、`[`、`]`、`;`、`"`、`,`、`<`、`.`、`>`、`/`、`?` 和 `|`。而 `!`、`@`、`#`、`$`、`%`、`^`、`&`、`(`、`)`、`-`、`_`、`{`、`}`、`'`、`` ` ``、`~` 等都可以正常作为名字的一部分输入。（可以联想到 RID Master 的 CN 为 `RID Manager$`，侧面也说明 `$` 是可以被使用的。）

![2025-07-23-special-chars1](https://images.charlesfeng.cn/2025-07-23-special-chars1.PNG)

![2025-07-23-special-chars2](https://images.charlesfeng.cn/2025-07-23-special-chars2.PNG)

![2025-07-23-special-chars3](https://images.charlesfeng.cn/2025-07-23-special-chars3.PNG)

后来确认，其实是属性 `sAMAccountName` 在限制这些字符。[官方文档](https://learn.microsoft.com/en-us/windows/win32/adschema/a-samaccountname) 有明确列出不能使用的字符 🤦🏻。不过好像文档里并没有提到点号 `.`，问了下 ChatGPT （是的我还爱它 ❤️），是被 UPN 限制，只是不能加在末尾，实际测试也是这样。

>#### 🧠 为什么实际使用中有时感觉 “`.` 不行”？
>
>这是因为 **`.@` 通常出现在 UPN（UserPrincipalName）** 中，如：
>
>```ini
>CN=Charles Feng, sAMAccountName=charles.feng, userPrincipalName=charles.feng@contoso.com
>```
>
>- 若你在 `sAMAccountName` 和 `userPrincipalName` 都用 `.`，一些系统或脚本可能混淆
>- Windows 登录时，如果输入 `charles.feng`，系统可能误以为是本地账户而不是域账户
>- 某些 LDAP query 或 PowerShell 脚本解析上可能会误解 `.` 是别的分隔符（尤其在正则、路径等上下文中）
>
>#### ✅ 实际建议
>
>- **允许使用 `.`, 但建议置于中间而非结尾**（如 `charles.feng` 可以，`charles.` 可能导致解析问题）
>- **不要让多个用户 `sAMAccountName` 只靠 `.` 差异化**（如 `john`, `john.smith`，否则易混）
>- 如果你在使用某个系统或工具时遇到点号报错，可以明确查是 UI、脚本、登录行为还是 legacy 系统做了限制

![2025-07-23-dot](https://images.charlesfeng.cn/2025-07-23-dot.PNG)

#### User Objects 实际存储在 ESE 数据库中的数据

![2025-07-23-actual-data](https://images.charlesfeng.cn/2025-07-23-actual-data.PNG)

需要注意的是，对 User `ChewDavidCNF1234#` （DNT 10239），其在数据库中实际存储的属性 `name` 并不包含 `\`。但通过 LDP 查看时会显示 `\`，这可能是由于转义或显示格式所致。

![2025-07-23-data-in-ldp](https://images.charlesfeng.cn/2025-07-23-data-in-ldp.PNG)

#### User Object 名称长度的限制

另外，我发现 `New-ADUser` 对名字有长度不能超过 20 个字符的限制，但是理论上对一个普通的 AD object 不会有这样的限制，因为我也看到过很多 object 的名字是超过 20 个字符的。

![2025-07-23-length-constraint](https://images.charlesfeng.cn/2025-07-23-length-constraint.PNG)

查看了类 [`User`](https://learn.microsoft.com/en-us/windows/win32/adschema/c-user) 上跟 name 相关的属性，发现虽然 [`sAMAccountName`](https://learn.microsoft.com/en-us/windows/win32/adschema/a-samaccountname) 的 `Range-Upper` 指定的是 256 个字符，但是有特别说明不能超过 20 个字符，所以限制正是源自这里。当然，根本原因应该更底层，因为这个属性是为了支持 Windows 98 之前的系统了 🥱。不过这种坑，除非踩到，不然谁知道啊！AD 这方面真的蛮难用的。。（顺带一提，对我组的 Sync Engine 来说，这个属性也是不需要维护的，说明在 M365 内部它已经被彻底 deprecated 掉了。）

FYI，其他属性如 [`cn/Common-Name`](https://learn.microsoft.com/en-us/windows/win32/adschema/a-cn)、[`sn/Surname`](https://learn.microsoft.com/en-us/windows/win32/adschema/a-sn)、 [`givenName`](https://learn.microsoft.com/en-us/windows/win32/adschema/a-givenname)、[`middleName/Other-Name`](https://learn.microsoft.com/en-us/windows/win32/adschema/a-middlename) 限制为 64 个字符，[`displayName`](https://learn.microsoft.com/en-us/windows/win32/adschema/a-displayname)、[`adminDisplayName`](https://learn.microsoft.com/en-us/windows/win32/adschema/a-admindisplayname) 等限制为 256 个字符。不过，真正 mandatory 的 name 相关的属性只有 `cn` 和 `sAMAccountName` 啦。

## 普通 AD Object

#### 对普通 Object 的命名限制

不过，好像这整个测试本来是为了验证是不是能主动创建一个类似 DEL/CNF 命名规则的 AD object……让我们回归一下初心 👋，跳出 User object 的限制，看看普通 object。

使用命令 [`New-ADObject`](https://learn.microsoft.com/en-us/powershell/module/activedirectory/new-adobject) 创建 Container object 时可以发现，之前在 User object 上被限制的字符，在这里都可以正常作为名称的一部分被使用，包括结尾带点号 `.` 也是没问题的。

![2025-07-23-naming-container](https://images.charlesfeng.cn/2025-07-23-naming-container.PNG)

上图还可以看出，我们确实可以成功创建符合 DEL/CNF 命名规则的对象。通过 ldp 查看这些对象时，类似地，我们可以看到部分字符被转义，包括 `\`、`"`、`,`、`;`、`+`、`<`、`=`、`>` 等。

![2025-07-23-data-in-ldp-general-objects](https://images.charlesfeng.cn/2025-07-23-data-in-ldp-general-objects.PNG)

#### 普通 Objects 实际存储在 ESE 数据库中的数据

但是当我们查看数据库数据时，可以发现：

1. ldp 中转义的字符是原文存储在数据库 `name` 中的，转义是 ldp 的行为。
2. 手动输入的 `\0A` 不会被识别为换行符。以 DNT 为 10276/10277 的对象为例，它们的 `name` 并不会像 DNT 为 10232/10233/10253 的那样在显示时真的换行。

![2025-07-23-actual-data-general-objects](https://images.charlesfeng.cn/2025-07-23-actual-data-general-objects.PNG)

#### 通过 `New-ADObject` 创建其他类型的 Objects

来都来了，看这个命令的 examples 里还有类型 Contact 和 Subnet，也就都试一试。

![2025-07-23-naming-contact](https://images.charlesfeng.cn/2025-07-23-naming-contact.PNG)

![2025-07-23-naming-subnet](https://images.charlesfeng.cn/2025-07-23-naming-subnet.PNG)

## 总结

1. ChatGPT 当时说得基本没问题：对普通 AD object 而言，AD 并不阻止用户人为创建包含 `\0ACNF:` 或 `\0ADEL:` 的 CN / DN。
2. 如果非要输入 DEL/CNF 格式的名称，从数据库的角度看，AD 是能够通过区分 `\0A` 来判断一个对象是不是真正的系统产生的 DEL/CNF 特殊对象。
3. AD User object 会因为 legacy 的属性 `sAMAccountName` 被限制名称不能超过 20 个字符。

## 参考

+ [Control character](https://en.wikipedia.org/wiki/Control_character)
+ [User class](https://learn.microsoft.com/en-us/windows/win32/adschema/c-user)
+ [SAM-Account-Name attribute](https://learn.microsoft.com/en-us/windows/win32/adschema/a-samaccountname)
+ [User Naming Attributes](https://learn.microsoft.com/en-us/windows/win32/ad/naming-properties)
