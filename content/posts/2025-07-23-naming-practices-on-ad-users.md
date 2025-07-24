---
date: 2025-07-23
title: '基于 AD User 的命名实践'
template: post
thumbnail: '../thumbnails/user.png'
slug: naming-practices-on-ad-users
categories:
  - Tech
tags:
  - Active Directory
  - Practices
---

基于[前文](/study_notes_as_ad_beginner) ChatGPT 提到的如下理论，我实际测试了一下 AD 中的命名规则。首先，`CNF`、`DEL` 本身并不是 AD 的保留字或特殊字符，只有当它们和 `\0A` 一起使用时才有特殊含义。而根据实践，在这些 user 对象里面真正被限制的其实是字符 `\` 和 `:`。

> Active Directory 不阻止用户人为创建包含 `\0ACNF:` 或 `\0ADEL:` 的 CN / DN

## 限制主动创建 CNF/DEL 对象的特殊字符

可以看出 `:` 和 `\` 是被严格限制的字符，不能直接用于 CN 中。

![2025-07-23-special-chars](https://images.charlesfeng.cn/2025-07-23-special-chars.PNG)

## 其他特殊字符

除了  `:` 和 `\` ， 我还测试了一些其他特殊字符，受限制的字符还包括 `*`、`=`、`+`、`[`、`]`、`;`、`"`、`,`、`<`、`.`、`>`、`/`、`?` 和 `|`。而 `!`、`@`、`#`、`$`、`%`、`^`、`&`、`(`、`)`、`-`、`_`、`{`、`}`、`'`、`` ` ``、`~` 等都可以正常作为名字的一部分输入。（可以联想到 RID Master 的 CN 为 `RID Manager$`，侧面也说明 `$` 是可以被使用的。）

![2025-07-23-special-chars1](https://images.charlesfeng.cn/2025-07-23-special-chars1.PNG)

![2025-07-23-special-chars2](https://images.charlesfeng.cn/2025-07-23-special-chars2.PNG)

![2025-07-23-special-chars3](https://images.charlesfeng.cn/2025-07-23-special-chars3.PNG)

后来确认，其实是属性 `sAMAccountName` 在限制这些字符。[官方文档](https://learn.microsoft.com/en-us/windows/win32/adschema/a-samaccountname) 有明确列出不能使用的字符 🤦🏻。不过好像文档里并没有提到点号 `.`，问了下 ChatGPT （是的我还爱他 ❤️），是被 UPN 限制，只是不能加在末尾。

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
>------
>
>#### ✅ 实际建议
>
>- **允许使用 `.`, 但建议置于中间而非结尾**（如 `charles.feng` 可以，`charles.` 可能导致解析问题）
>- **不要让多个用户 `sAMAccountName` 只靠 `.` 差异化**（如 `john`, `john.smith`，否则易混）
>- 如果你在使用某个系统或工具时遇到点号报错，可以明确查是 UI、脚本、登录行为还是 legacy 系统做了限制

![2025-07-23-dot](https://images.charlesfeng.cn/2025-07-23-dot.PNG)

## 实际存储在 ESE 中的数据

![2025-07-23-actual-data](https://images.charlesfeng.cn/2025-07-23-actual-data.PNG)

需要注意的是，对于 user `ChewDavidCNF1234#` （DNT 10239），其在数据库中实际存储的属性 `name` 并不包含 `\`。但通过 LDP 查看时会显示 `\`，这可能是由于转义或显示格式所致。

![2025-07-23-data-in-ldp](https://images.charlesfeng.cn/2025-07-23-data-in-ldp.PNG)

## User 对象名称长度的限制

另外，我发现 `New-ADUser` 对名字有长度不能超过 20 个字符的限制，但是理论上对一个普通的 AD object 不会有这样的限制，因为我也看到过很多 object 的名字是超过 20 个字符的。

![2025-07-23-length-constraint](https://images.charlesfeng.cn/2025-07-23-length-constraint.PNG)

查看了类 [`User`](https://learn.microsoft.com/en-us/windows/win32/adschema/c-user) 上跟 name 相关的属性，发现虽然 [`sAMAccountName`]() 的 `Range-Upper` 指定的是 256 个字符，但是有特别说明不能超过 20 个字符，所以限制正是源自这里。当然，根本原因应该更底层，因为这个属性是为了支持 Windows 98 之前的系统了 🥱。不过这种坑，除非踩到，不然谁知道啊！AD 这方面真的蛮难用的。。（顺带一提，对我组的 Sync Engine 来说，这个属性也是不需要维护的，说明在 M365 内部它已经被彻底 deprecated 掉了。）

FYI，其他属性如 [`cn/Common-Name`](https://learn.microsoft.com/en-us/windows/win32/adschema/a-cn)、[`sn/Surname`](https://learn.microsoft.com/en-us/windows/win32/adschema/a-sn)、 [`givenName`](https://learn.microsoft.com/en-us/windows/win32/adschema/a-givenname)、[`middleName/Other-Name`](https://learn.microsoft.com/en-us/windows/win32/adschema/a-middlename) 限制为 64 个字符，[`displayName`](https://learn.microsoft.com/en-us/windows/win32/adschema/a-displayname)、[`adminDisplayName`](https://learn.microsoft.com/en-us/windows/win32/adschema/a-admindisplayname) 等限制为 256 个字符。不过，真正 mandatory 的 name 相关的属性只有 `cn` 和 `sAMAccountName` 啦，

最后，好像这整个测试本来是为了验证是不是能主动创建一个类似 DEL/CNF 命名规则的 AD object 的……算了，下次再说吧 👋。

## 参考

+ [User class](https://learn.microsoft.com/en-us/windows/win32/adschema/c-user)
+ [SAM-Account-Name attribute](https://learn.microsoft.com/en-us/windows/win32/adschema/a-samaccountname)
+ [User Naming Attributes](https://learn.microsoft.com/en-us/windows/win32/ad/naming-properties)
