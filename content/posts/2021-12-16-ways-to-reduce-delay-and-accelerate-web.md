---
date: 2021-12-16
title: '减少延迟并加快 Web 页面访问速度的奇淫巧技'
template: post
thumbnail: '../thumbnails/http.png'
slug: ways-to-reduce-delay-and-accelerate-web
categories:
  - Tech
tags:
  - Reproduced
  - Web
  - HTTP
---

为了解决延迟带来的苦恼，永远都会有聪明的探索者找出新的捷径来。互联网的蓬勃兴盛催生出了各种新奇技巧，我们来依次看下这些“捷径”及各自的优缺点。

#### Spriting（图片合并）

Spriting 指的是将多个小图片合并到一张大的图片里，这样多个小的请求就被合并成了一个大的图片请求，然后再利用 JS 或者 CSS 文件来取出其中的小张图片使用。好处显而易见，请求数减少，延迟自然低。坏处是文件的粒度变大了，有时候我们可能只需要其中一张小图，却不得不下载整张大图，cache 处理也变得麻烦，在只有一张小图过期的情况下，为了获得最新的版本，不得不从服务器下载完整的大图，即使其它的小图都没有过期，显然浪费了流量。

#### Inlining（内容内嵌）

Inlining 的思考角度和 Spriting 类似，是将额外的数据请求通过 base64 编码之后内嵌到一个总的文件当中。比如一个网页有一张背景图，我们可以通过如下代码嵌入：`background: url(data:image/png;base64,<data>)`。data 部分是 base64 编码之后的字节码，这样也避免了一次多余的 HTTP 请求。但这种做法也有着和 Spriting 相同的问题，资源文件被绑定到了其它文件，粒度变得难以控制。

#### Concatenation（文件合并）

Concatenation 主要是针对 JS 这类文件，现在前端开发交互越来越多，零散的 JS 文件也在变多。将多个 JS 文件合并到一个大的文件里在做一些压缩处理也可以减小延迟和传输的数据量。但同样也面临着粒度变大的问题，一个小的 JS 代码改动会导致整个 JS 文件被下载。

#### Domain Sharding（域名分片）

前面我提到过很重要的一点，浏览器或者客户端是根据 domain（域名）来建立连接的。比如针对 www.example.com 只允许同时建立 2 个连接，但 mobile.example.com 被认为是另一个域名，可以再建立两个新的连接。以此类推，如果我再多建立几个 sub domain（子域名），那么同时可以建立的 HTTP 请求就会更多，这就是 Domain Sharding 了。连接数变多之后，受限制的请求就不需要等待前面的请求完成才能发出了。这个技巧被大量的使用，一个颇具规模的网页请求数可以超过 100，使用 Domain Sharding 之后同时建立的连接数可以多到 50 个甚至更多。

这么做当然增加了系统资源的消耗，但现在硬件资源升级非常之快，和用户宝贵的等待时机相比起来实在微不足道。

Domain Sharding还有一大好处，对于资源文件来说一般是不需要 cookie 的，将这些不同的静态资源文件分散在不同的域名服务器上，可以减小请求的 size。

不过Domain Sharding只有在请求数非常之多的场景下才有明显的效果。而且请求数也不是越多越好，资源消耗是一方面，另一点是由于 TCP 的 slow start 会导致每个请求在初期都会经历 slow start，还有 TCP 三次握手，DNS 查询的延迟。这一部分带来的时间损耗和请求排队同样重要，到底怎么去平衡这二者就需要取一个可靠的连接数中间值，这个值的最终确定要通过反复的测试。移动端浏览器场景建议不要使用 Domain Sharding，具体细节参考[这篇文章](https://link.segmentfault.com/?enc=r5qyAojH9y%2B%2FVsNPzR228Q%3D%3D.qcoETDxrWzzQPlV%2FKYxfgH5eFGyEKNsenxbmUs2Yu8bSNYBqh%2Fq%2Fa8oVCuJwTvW%2BDAeuhHad1aC9uU5D7LxHwWOy6J7f7hyA8cpUyDMAuQ4%3D)。

> 除非你有紧急而迫切的需求，不要使用这一过时的技术，升级到 HTTP/2 就好了。在 HTTP/2 里，做域名分片就没必要了：HTTP/2 的连接可以很好的处理并发的无优先级的请求。域名分片甚至会影响性能。大多数 HTTP/2 的实现还会使用一种称作[连接凝聚](https://daniel.haxx.se/blog/2016/08/18/http2-connection-coalescing/)的技术去尝试合并被分片的域名。
>
> <div style='float:right'><a href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Connection_management_in_HTTP_1.x#domain_sharding">Domain sharding on MDN</a></div>



## 来源

[HTTP 2.0 的那些事](https://segmentfault.com/a/1190000004399183)

