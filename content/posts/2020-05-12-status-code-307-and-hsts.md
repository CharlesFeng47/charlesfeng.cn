---
date: 2020-05-12
title: 'HTTPS -> HTTP 引起的 307 状态码与 HSTS'
template: post
thumbnail: '../thumbnails/https.png'
slug: status-code-307-and-hsts
categories:
  - Tech
tags:
  - HTTPS
  - Web
  - DevOps
---

## 问题背景

[前文](/transfer-from-netlify-to-my-aliyun-server)说到因为 Netlify 在境外，访问速度不太理想，所以迁移到了阿里云。又因为之前在 Netlify 时，一键启用 HTTPS（再次怀念🥺），所以就没有手动配置相关证书。而在域名 charlesfeng.cn 备案下来后，我着手将其解析到自己的服务器上，完成前文的剩余工作。理想情况下，我只需要在阿里云 DNS 云解析上添加相应的 A 解析到对应 ip，然后在服务器上启用 Let's Encrypt 的免费证书就完成。

但是，理想很丰满，现实很残酷，在添加对应 DNS Record 后我通过浏览器始终无法访问网页。最开始认为是 DNS 还未生效，但是十来分钟后可以通过域名 ping 到对应 ip，而浏览器仍然无法访问，就很奇怪了。Chrome 和 Safari 行为相同，所以下文均以 Chrome 为例讲解。

## debug 思路

#### DNS Record 未生效

首先排除此思路，因为如下图我已经可以 ping 到了，说明 DNS Resolver 已经同步了对应记录。如果需要复习 DNS 的解析过程可参考[这里](/dns-resolve)。

![](https://cdn.charlesfeng.top/images/2020-05-12-ping-domain.png)

#### 浏览器的自身缓存

其次，怀疑是 Chrome 浏览器自身缓存了 DNS Record，所以解析到原先 Netlify 的域名 charlesfeng.netlify.app 上去了，但是这有两个不合理点。

1. 就算解析到原先 Netlify 的域名，那么我 Netlify 的域名也是能够正常访问的。
2. 既然缓存了，那么就把缓存清掉。（不过我都刷新 N 次了，Chrome 还不去更新下吗？这样感觉很不科学。）于是，查找资料，通过 `chrome://net-internals/#dns` 清楚了缓存，still not working。

#### Cookie

此时，我突然福临心至，打开无痕模式尝试访问，结果成功了（这就很迷🥱）。同一台机器的 Chrome 是否无痕模式还能有两种操作...印象中，无痕模式不是只是不携带 Cookie 之类的吗？跟能不能访问博客有什么关系...不过还是尝试清除 Cookie，意料之中不起作用🥶

#### 控制台

最后，我终于想起来看 Chrome 控制台了...结果如下图。（还是不够有直觉啊 555，我不是一个合格的程序员😤）

![](https://cdn.charlesfeng.top/images/2020-05-12-1-http.png)

![](https://cdn.charlesfeng.top/images/2020-05-12-2-https.png)

可以看到，当输入域名 http://charlesfeng.cn 后，首先返回了 307 状态码，重定向到 https://charlesfeng.cn，而我目前还没有配置 SSL 证书，所以自然无法安全访问。

因此，问题明确。

## HSTS

观察到上图 HTTP 转发处有 Header——`Non-Authoritative-Reason : HSTS`。首先我们需要了解 HSTS 是什么。下面是来自 MDN 的[相关介绍](https://developer.mozilla.org/zh-CN/docs/Glossary/HSTS)。

> HSTS （英语：**H**TTP **S**trict **T**ransport **S**ecurity，HTTP 严格传输安全）让网站可以通知浏览器它不应该再使用 HTTP 加载该网站，而是自动转换该网站的所有的HTTP链接至更安全的 HTTPS。它包含在 HTTP 的协议头 [`Strict-Transport-Security`](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Strict-Transport-Security) 中，在服务器返回资源时带上。
>
> 换句话说，它告诉浏览器将 URL 协议从 HTTP 更改为 HTTPS（会更安全），并要求浏览器对每个请求执行此操作。

所以，猜测是 Netlify 自动在响应中设置了 HSTS，从而导致我这个域名被强制跳转 HTTPS 了。

访问我的另一个域名 cuihuaergou.top 验证下。（对，我的域名就是这么多🥰）可以看到确实在响应中设置了 `Strict-Transport-Security` 字段，`max-age=31536000` 表示自动使用 HTTPS 连接的时间为一年。（虽然害我这里查了会儿资料，但是 Netlify 这功能也太好了叭😭，学习了学习了）

![](https://cdn.charlesfeng.top/images/2020-05-12-reponse-hsts.jpg)

详细的 `Strict-Transport-Security` 可以参见 MDN 的[相关说明](https://developer.mozilla.org/zh-CN/docs/Security/HTTP_Strict_Transport_Security)，需要特别注意的是非加密传输（即 HTTP）时设置的 HSTS 字段无效， `Strict-Transport-Security` 字段会被浏览器**忽略**。（因为攻击者可以通过中间人攻击的方式在连接中修改、注入或删除它。只有在你的网站通过 HTTPS 访问并且没有证书错误时，浏览器才认为你的网站支持 HTTPS 然后使用 `Strict-Transport-Security` 的值。）

下面记录下浏览器如何处理的。

> 你的网站第一次通过 HTTPS 请求，服务器响应 `Strict-Transport-Security` 头，浏览器记录下这些信息，然后后面尝试访问这个网站的请求都会自动把 HTTP 替换为 HTTPS。
>
> 当 HSTS 头设置的过期时间到了，后面通过 HTTP 的访问恢复到正常模式，不会再自动跳转到 HTTPS。
>
> 每次浏览器接收到 Strict-Transport-Security 头，它都会更新这个网站的过期时间，所以网站可以刷新这些信息，防止过期发生。
>
> Chrome、Firefox 等浏览器里，当您尝试访问该域名下的内容时，会产生一个 307 Internal Redirect（内部跳转），自动跳转到 HTTPS 请求。

注意最后一段话，Chrome 访问该域名时，会产生一个 307 的内部跳转，并自动重定向到该地址的 HTTPS 版本。**这个 307 响应是虚假的（dummy）**，而非服务器生成的——即 Chrome 是先在**内部**进行了此操作，（注意此 307 状态码的描述是 Internal Redirect，而 307 状态码本身的描述是 Temporary Redirect，）然后才发出真正到达目标服务器的 HTTPS 请求。

除了网站手动设置 Header `Strict-Transport-Security` ，还可以通过预加载 HSTS 的方式，将自己的域名提交到 Chrome 自动包含的预加载列表中。

> 谷歌维护着一个 [HSTS 预加载服务](https://hstspreload.appspot.com/)。按照如下指示成功提交你的域名后，浏览器将会永不使用非安全的方式连接到你的域名。虽然该服务是由谷歌提供的，但所有浏览器都有使用这份列表的意向（或者已经在用了）。但是，这不是 HSTS 标准的一部分，也不该被当作正式的内容。
>
> - Chrome & Chromium 的 HSTS 预加载列表： [https://www.chromium.org/hsts](https://www.chromium.org/hsts)
> - Firefox 的 HSTS 预加载列表：[nsSTSPreloadList.inc](https://dxr.mozilla.org/comm-central/source/mozilla/security/manager/ssl/nsSTSPreloadList.inc)

#### 作用

作用与不足均参考[维基](https://zh.wikipedia.org/wiki/HTTP%E4%B8%A5%E6%A0%BC%E4%BC%A0%E8%BE%93%E5%AE%89%E5%85%A8)。

> HSTS 可以用来抵御 SSL 剥离攻击。SSL 剥离攻击是[中间人攻击](https://zh.wikipedia.org/wiki/中间人攻击)的一种，由 [Moxie Marlinspike](https://zh.wikipedia.org/w/index.php?title=Moxie_Marlinspike&action=edit&redlink=1) 于 2009 年发明。他在当年的黑帽大会上发表的题为 "New Tricks For Defeating SSL In Practice" 的演讲中将这种攻击方式公开。SSL 剥离的实施方法是阻止浏览器与服务器创建 HTTPS 连接。它的前提是用户很少直接在地址栏输入 `https://`，用户总是通过点击链接或 [3xx 重定向](https://zh.wikipedia.org/wiki/3xx重定向)，从 HTTP 页面进入 HTTPS 页面。所以攻击者可以在用户访问 HTTP 页面时替换所有 `https://` 开头的链接为 `http://`，达到阻止 HTTPS 的目的。
>
> HSTS 可以很大程度上解决 SSL 剥离攻击，因为只要浏览器曾经与服务器创建过一次安全连接，之后浏览器会强制使用 HTTPS，即使链接被换成了 HTTP。
>
> 另外，如果中间人使用自己的自签名证书来进行攻击，浏览器会给出警告，但是许多用户会忽略警告。HSTS 解决了这一问题，一旦服务器发送了 HSTS 字段，将不再允许用户忽略警告。

#### 不足

> 用户首次访问某网站是不受 HSTS 保护的。这是因为首次访问时，浏览器还未收到 HSTS，所以仍有可能通过明文 HTTP 来访问。解决这个不足当前有两种方案，一是浏览器预置 HSTS 域名列表，[Google Chrome](https://zh.wikipedia.org/wiki/Google_Chrome)、[Firefox](https://zh.wikipedia.org/wiki/Firefox)、[Internet Explorer ](https://zh.wikipedia.org/wiki/Internet_Explorer)和 [Microsoft Edge](https://zh.wikipedia.org/wiki/Microsoft_Edge)实现了这一方案。二是将 HSTS 信息加入到[域名系统](https://zh.wikipedia.org/wiki/域名系统)记录中。但这需要保证 DNS 的安全性，也就是需要部署[域名系统安全扩展](https://zh.wikipedia.org/wiki/域名系统安全扩展)。截至 2016 年这一方案没有大规模部署。
>
> 由于 HSTS 会在一定时间后失效（有效期由 max-age 指定），所以浏览器是否强制 HSTS 策略取决于当前系统时间。部分操作系统经常通过[网络时间协议](https://zh.wikipedia.org/wiki/網絡時間協議)更新系统时间，如 [Ubuntu](https://zh.wikipedia.org/wiki/Ubuntu) 每次连接网络时、[OS X Lion](https://zh.wikipedia.org/wiki/OS_X_Lion) 每隔9分钟会自动连接时间服务器。攻击者可以通过伪造 NTP 信息，设置错误时间来绕过 HSTS。解决方法是认证 NTP 信息，或者禁止 NTP 大幅度增减时间。比如 [Windows 8](https://zh.wikipedia.org/wiki/Windows_8) 每 7 天更新一次时间，并且要求每次 NTP 设置的时间与当前时间不得超过 15 小时。

## 解决思路

虽然最后自己肯定会上 HTTPS，上了之后肯定就没这个问题了，但是咱不能这样对不对，咱是专业的，所以来解决下。

在 StackOverflow 上发现这样几种[解决方案](https://stackoverflow.com/a/34213531)。

1. 在 Chrome 的 URL 字段中输入以下内容：`chrome://net-internals/#hsts`，然后搜索您的网站并将其删除。（最后我采用的😋）
2. 您也可以在顶级域中设置它并包括子域，因此您可能需要从那里删除。（原文：You may also set this at a top level domain and include subdomains so you may need to delete from there.）（没看太懂...感觉他想描述的情况是 `Strict-Transport-Security` 字段中设置了子域的情况，语法为 `Strict-Transport-Security: max-age=<expire-time>; includeSubDomains`。这样当子域不再需要 HTTPS 时，可以对父域的 Header 进行更新以丢弃 `includeSubDomains`。）
3. 更改服务器配置中的 Header `Strict-Transport-Security` 字段：先发布 `max-age` 为 0 的 Header，然后重新访问网站以清除此 Header，最后停止发布此 Header。这对于其他不太容易清除 Header 的浏览器很有帮助。

> 请注意，如果网站位于预加载列表中，则无法清除此设置，因为该网站已嵌入在 Web 浏览器的代码中。网站所有者可以提交要从预加载列表中删除的请求，但这需要花几个月的时间才能完成 Chrome 的发布周期，而其他浏览器则没有明确的时间表。出于安全原因，Chrome 也无法覆盖预加载的设置。

在 Chrome 中键入 `chrome://net-internals/#hsts`，先搜索域名，结果如下图。删除后，可以通过 HTTP 正常访问。

![](https://cdn.charlesfeng.top/images/2020-05-12-chrome-hsts-query.png)

因为 Chrome 版本更新的问题（我是 v81.0.4044.138），具体界面跟[此处](https://really-simple-ssl.com/knowledge-base/clear-hsts-browser/)描述的不太一样，所以也记录下。（~~涨字数~~）

>1. In the address bar, type “chrome://net-internals/#hsts”.
>2. Type the domain name in the text field below “Delete domain security policies”.
>3. Click the “Delete” button.
>4. Type the domain name in the text field below “Query HSTS/PKP domain”.
>5. Click the “Query” button.
>6. Your response should be “Not found”.

## Safari 较 Chrome 的不同

估计 Safari 也是同样的问题，但是按照上述解决方案的 Safari 版本（如下所示）解决并没有解决问题...改天再找找吧😂

>1. Close Safari.
>2. Delete the ~/Library/Cookies/HSTS.plist file.
>3. Reopen Safari.

## 参考

2. [如何刷新本机DNS缓存（Win+Linux+OSX）](https://blog.csdn.net/zhyl8157121/article/details/100551350)
3. [MDN 307 Temporary Redirect](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Status/307)
4. [MDN HSTS](https://developer.mozilla.org/zh-CN/docs/Glossary/HSTS)
5. [MDN HTTP Strict Transport Security](https://developer.mozilla.org/zh-CN/docs/Security/HTTP_Strict_Transport_Security)
6. [WIKI HTTP 严格传输安全](https://zh.wikipedia.org/wiki/HTTP%E4%B8%A5%E6%A0%BC%E4%BC%A0%E8%BE%93%E5%AE%89%E5%85%A8)
7. [Status Code:307 Internal Redirect 和 Non-Authoritative-Reason:HSTS 问题](https://www.jianshu.com/p/005f3466b714)
8. [Non-Authoritative-Reason header field HTTP](https://stackoverflow.com/a/34213531)
9. [How to clear HSTS from your browser]([https://really-simple-ssl.com/knowledge-base/clear-hsts-browser/])

