---
date: 2022-01-17
title: 'gRPC 为什么使用 HTTP/2'
template: post
thumbnail: '../thumbnails/grpc.png'
slug: why-grpc-uses-http2
categories:
  - Tech
  - Thinking
  - Popular
tags:
  - gRPC
  - RPC
  - HTTP
---

## 0. 写在前面

因为本人之前只使用过 Thrift，所以在真正使用 gRPC 并发现它有 HTTP Header 之后，脑海中便产生了一个大大的问号，为什么一个 RPC 框架要跟 HTTP 混在一起呢？比如之前使用过的 Thrift 就是一个很单纯的 RPC 框架，它本身并不支持通过 HTTP 进行访问，所以在我看来，RPC 也是一种应用层协议，那为什么要跟同为应用层的 HTTP 协议混淆在一起呢？gRPC 为什么要基于 HTTP/2 而不是像 Thrift 一样自己实现一套应用层协议呢？

于是便有了这篇文章，我在做了一些搜索并回顾了 HTTP 的发展历程后，来尝试回答一下自己的问题。

防杠 PS：RPC （远程过程调用）是一个很宽泛的概念，HTTP 其实在某种意义上我觉得也可以看做是一种特殊的 RPC，DNS 解析则是它的服务发现。不过本文所指的 RPC 都是 RPC 框架这样一个完整的远程调用方案（包括接口规范、序列化反序列化规范、通信协议等），且并不深入讨论宽泛的 RPC 概念与 HTTP，有兴趣可参见 [既然有 HTTP 请求，为什么还要用 RPC 调用？ - 易哥的回答 - 知乎](https://www.zhihu.com/question/41609070/answer/1030913797)。

## 1. HTTP/1.0 => HTTP/1.1

网络上已经有很多的文章与博客写过 HTTP/1.0 与 HTTP/1.1 的异同与改进点，本文此部分主要也摘自 [HTTP 2.0 的那些事](https://segmentfault.com/a/1190000004399183)，（修改了一点点），以备本人回顾复习之用。

#### 1.1 HTTP/1.0 的问题

HTTP/1.0 被抱怨最多的就是**连接无法复用**，和**队头阻塞 head of line blocking** （以下简称 HOL blocking）这两个问题。理解这两个问题有一个十分重要的前提：客户端是依据域名来向服务器建立连接，一般 PC 端浏览器会针对单个域名的 server 同时建立 6～8 个连接，手机端的连接数则一般控制在 4～6 个。显然连接数并不是越多越好，资源开销和整体延迟都会随之增大。

**连接无法复用**会导致每次请求都经历 TCP 的三次握手和慢启动。三次握手在高延迟的场景下影响较明显，慢启动则对文件类大请求影响较大。

**HOL blocking** 会导致带宽无法被充分利用，以及后续健康请求被阻塞。假设有 5 个请求同时发出，对于 HTTP/1.0 的实现，在第一个请求没有收到回复之前，后续从应用层发出的请求只能排队，请求 2/3/4/5 只能等请求 1 的 response 回来之后才能逐个发出。网络通畅的时候性能影响不大，一旦请求 1 的 request 因为什么原因没有抵达服务器，或者 response 因为网络阻塞没有及时返回，影响的就是所有后续请求，问题就变得比较严重了。

#### 1.2 解决连接无法复用

HTTP/1.0  里默认并不使用长连接，但在协议头里可以设置 `Connection:keep-alive`，设置后可以在一定时间内复用连接，具体复用时间的长短可以由服务器控制，比如使用 [`Keep-Alive`](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Keep-Alive) 协议头来指定一个最小的连接保持时间（如 ` Keep-Alive: timeout=5, max=1000`）。此外，把 `Connection` 设置成 `close` 以外的其它参数都可以让其保持长连接，通常会设置为 `retry-after`。

在 HTTP/1.1 里默认就是长连接的， 即 `Connection` 的默认值就是 `keep-alive`，协议头都不用再去声明它 (但我们还是会把它加上，万一某个时候因为某种原因要退回到 HTTP/1.0 呢)。如果要关闭连接复用需要显式地设置 `Connection:close`。一段时间内的连接复用对 PC 端浏览器的体验帮助很大，因为大部分的请求在集中在一小段时间以内。但对移动 app 来说，成效不大，app 端的请求比较分散且时间跨度相对较大。

#### 1.3 解决队头阻塞 HOL Blocking

HOL blocking 是 HTTP/2.0 之前网络体验的最大祸源。因为健康的请求会被不健康的请求影响，而且这种体验的损耗受网络环境影响，出现随机且难以监控。为了解决 HOL blocking 带来的延迟，协议设计者设计了一种新的 pipelining 机制。

同样假设有 5 个请求同时发出，和 HTTP/1.0 相比最大的差别是，HTTP/1.1 的请求 2/3/4/5 不用等请求 1 的 response 返回之后才发出，而是几乎在同一时间把 request 发向了服务器。请求 2/3/4/5 及所有后续共用该连接的请求节约了等待的时间，极大地降低了整体延迟。

不过 pipelining 并不是救世主，它也存在不少缺陷：

- pipelining 只能适用于 HTTP/1.1，一般来说，支持 HTTP/1.1 的 server 都要求支持 pipelining。
- **只有幂等的请求（GET/HEAD/PUT/DELETE 等）能使用 pipelining**，非幂等请求比如 POST 不能使用，因为请求之间可能会存在先后依赖关系。
- HOL blocking 并没有完全得到解决，**server 的 response 还是要求依次返回**，遵循 FIFO（first in first out）原则。也就是说如果请求 1 的 response 没有回来，请求 2/3/4/5 的response也不会被送回来。
- 绝大部分的 HTTP 代理服务器不支持 pipelining。
- 和不支持 pipelining 的老服务器协商有问题。
- 可能会导致新的 Front of queue blocking 问题。

据 [MDN](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Connection_management_in_HTTP_1.x#http_%E6%B5%81%E6%B0%B4%E7%BA%BF)，HTTP 流水线在现代浏览器中并不是默认被启用的。Chrome 则是移除了 enable pipelining 的选项，详情可参见此[问题描述](https://www.chromium.org/developers/design-documents/network-stack/http-pipelining/)。

#### 1.4 HTTP/1.1 的其他优化

- 支持同时打开多个 TCP 连接
- 支持虚拟主机
- 新增状态码 100
- 支持分块传输编码
- 新增缓存处理指令 max-age

## 2. HTTP/1.1 => HTTP/2

HTTP/2 从协议层优化了 HTTP/1.x 而不是如同 HTTP/1.1 一样修修补补，主要包括以下几个方面。

#### 2.1 二进制分帧 Binary Format 与多路复用 Multiplexing

HTTP/1.x 中的队头阻塞问题主要是因为协议本质上是纯文本的，在资源块（resource chunks）之间不使用分隔符。作为一种解决办法，浏览器打开许多并行 TCP 连接，这既不高效，也不可扩展。因此，HTTP/2 的目标非常明确：**我们能够回到单个 TCP 连接，解决队头阻塞问题**。换一种说法：我们希望能够正确地复用资源块（resource chunks）。这在 HTTP/1.x 中是不可能的，因为没有办法分辨一个块属于哪个资源，或者它在哪里结束，另一个块从哪里开始。HTTP/2 非常优雅地解决了这一问题，它在资源块之前添加了**帧（frames）**。

HTTP/2 将报文分成 Headers 帧和 Data 帧等，它们都是二进制格式的。在通信过程中，对单个域名只会有一个 TCP 连接存在，它承载了任意数量的双向数据流（Stream）。

- 一个数据流（Stream）都有一个唯一标识符和可选的优先级信息，用于承载双向信息。
- 消息（Message）是与逻辑请求或响应对应的完整的一系列帧。
- 帧（Frame）是最小的通信单位，来自不同数据流的帧可以交错发送，然后再根据每个帧头的数据流标识符重新组装。

这样做的好处显而易见，比如说：

+ 减少了 HTTPS 时的 TCP 三次握手（需要 1 个 RTT，最后 Client Ack 后直接开始 TLS 握手）、TLS 握手（需要 2 个 RTT）。
+ 避免了 TCP 慢启动的拥塞控制。
+ Server 的并发数得到了最大利用，比如单台 Server 并发 1000，那么同时可以支持 1000 个 Client。

此外，队头阻塞问题的解决还跟可以设置流的优先级有关。在流量有限的时候，或者需要优先响应某些资源的时候，HTTP/2 通过流优先级（Stream Priority）策略来管理这些流，优先级高的 Stream 会被 Server 优先处理并返回给客户端。有三种策略，分别是 Stream Dependencies、Exclusive 和 Dependency Weighting，详情可以参考[文档](https://www.rfc-editor.org/rfc/rfc7540#section-5.3)。

最后需要记住的是，HTTP/2 的多路复用解决了应用层 HOL blocking 的问题，但是仍然存在传输层 TCP 的 HOL blocking，因为 TCP 将 HTTP/2 数据抽象为一个单一的、有序的、但不透明的流，它把所有的东西看作一个大流。所以如果一个 TCP 包丢失，所有后续的包都需要等待它的重传，即使它们包含来自不同流的无关联数据。有兴趣可以参考[这篇文章](https://zhuanlan.zhihu.com/p/330300133)。

#### 2.2 服务端推送

HTTP/2 在客户端请求一个资源时，会把客户端需要的相关内容和资源预先推送过去，客户端就不需要再次发起请求了，所以也叫「cache push」。例如，客户端请求 page.html 页面，服务端就把 script.js 和 style.css 等与之相关的资源一起发给客户端。

另外有一点值得注意的是，客户端如果退出某个业务场景，出于流量或者其它因素需要取消 server push，也可以通过发送 RST_STREAM 类型的 frame 来做到。

#### 2.3 首部压缩

HTTP/1.x 的首部带有大量信息，而且每次都要重复发送。HTTP/2 要求通讯双方的客户端和服务器同时维护和更新一个包含之前见过的 header fields 首部字段表，从而通过避免重复 header 的传输减小了实际需要传输的大小。

不仅如此，高效的压缩算法可以很大地压缩 header，减少发送包的数量从而降低延迟。HTTP/2.0 使用 HPACK 编码来对整个头部进行了压缩，并（**optional**）可以使用 Huffman 编码对 string 字段进行压缩使用更少的字符。具体压缩细节可参见[这篇博文](http://laoqingcai.com/http2-headercompression2/index.html)，对 Huffman 编码为什么是可选的有疑惑可参见此 [StackOverflow](https://stackoverflow.com/questions/58141642/why-is-huffman-encoding-optional-in-http-2-hpack)。

#### 2.4 流量控制

使用流进行多路复用会导致争用TCP连接，导致流阻塞。流量控制方案确保同一连接上的流不会破坏性地互相干扰。流量控制可以作用于单个流或者整个连接，是逐跳的，而且**流量控制仅仅作用于 Data Frame**。

TCP 协议通过 [sliding window](http://laoqingcai.com/tcp-slidingwindow/index.html) 的算法来做流量控制。发送方有个 sending window，接收方有 receive window，HTTP/2 的 flow control 是类似 receive window 的做法。流量控制窗口 window 是一个简单的整数，数据的接收方通过告知对方自己的 flow window 大小表明自己还能接收多少数据，也表示允许发送方能传输多少个八位字节。窗口的大小间接衡量了接收者缓冲区的容量。

如果接收方在 flow window 为零的情况下依然收到更多的 frame，则会返回 block 类型的 frame，这张场景一般表明 HTTP/2 的部署出了问题。

## 3. gRPC 与 HTTP/2

其实官方对我提出的这个问题算是有所解答的。

一是在其[官方博客](https://developers.googleblog.com/2015/02/introducing-grpc-new-open-source-http2.html)上。HTTP/2 标准带来了许多好处，比如双向流、流控制、首部压缩、一条 TCP 连接的多路复用等。这些功能可以在减少电量和数据使用量，同时使得云原生的服务和 web 应用更快。

> Building on HTTP/2 standards brings many capabilities such as bidirectional streaming, flow control, [header compression](http://tools.ietf.org/html/draft-ietf-httpbis-header-compression-12), multiplexing requests over a single TCP connection and more. These features save battery life and data usage on mobile while speeding up services and web applications running in the cloud.

二是有人在 GitHub 上提过有关该问题的 [Issue](https://github.com/grpc/grpc/issues/6292)，官方解答表示 HTTP2 是业内标准，并且 HTTP 对代理、防火墙和其他软件都很友好。HTTP/2 的流式也很适合 gRPC 的需求，因此没必要重新造轮子。

> HTTP2 is used for many good reasons: HTTP2 is a standard and HTTP protocol is well known to proxies, firewalls and many software tools. The streaming nature of HTTP2 suits our needs very well, so no need to reinvent the wheel. We'll probably post more on this topic soon on grpc.io page.

虽然 HTTP/2 有着种种优势，但是我还是觉得如果 gRPC 致力于成为**最快**的 RPC 框架，那么一定不会选择基于 HTTP 来做，因为通用就意味着妥协，那么必然不能把性能发挥到极致。而这些 HTTP 的优势如果由 Google 自己再另起炉灶做一套，我相信也一定也都不会逊色。所以这些其实并没有说服我。。😅 而且可能是在巨硬呆久了，总觉得用别人的东西在合规性、安全性等方面都有所限制与顾虑，总得自己再造一遍轮子才放心。。（逃 😵

但是！在深入研究 HTTP/2、回顾 HTTP 发展历史的时候，我发现它其实是基于 SPDY 而实现的，而 SPDY 正是由 Google 开源的，which means HTTP/2 其实就是 Google 在推动啊！！同时，想到 HTTP/1.1 在业界的支持并不好，Google 着力于推广 HTTP/2 也是正常。然后就开始在网络上搜索是否有人对此有类似的观点，最后在这篇[写得很好的文章](https://segmentfault.com/a/1190000004399183)（也是一篇对 HTTP 历史整理得很好的文章）中看到了他的观点。其实本人在互联网上并没有搜索到什么阴谋论发言。。不过这显得我有点小人之心度君子之腹了。。🥵

> SPDY 和 HTTP/2 之间的暧昧关系，以及 Google 作为 SPDY 的创造者，这两点很容易让阴谋论者怀疑 Google 是否会成为协议的最终收益方。这其实是废话，Google 当然会受益，任何新协议使用者都会从中受益，至于谁吃肉，谁喝汤看的是自己的本事。从整个协议的变迁史也可以粗略看出，新协议的诞生完全是针对业界现存问题对症下药，并没有 Google 业务相关的痕迹存在，Google 至始至终只扮演了一个角色：you can you up。

Anyway，这也再次说明，机会是留给有准备的人（不要突然拔高价值观啊喂），这一切都是基于 HTTP/2 足够优秀，不然通过 gRPC 推广 HTTP/2 也只能灰飞烟灭。不过 Google 不想在本身就是由自己设计并推动的 SPDY/(HTTP/2) 上重复造轮子，也是自然的。🤧

此时，回过头来再看 gRPC 的 [motivation](https://grpc.io/blog/principles/#motivation)。我们可以看到，gRPC 是由原来 Google 内部的一个名为 Stubby 的通用 RPC infra 演变而来的。然而，它不基于任何标准，而且与 Google 的内部基础设施结合得太过紧密，因此被认为不适合公开发布。随着 SPDY、HTTP/2 和 QUIC 的出现，许多相同的功能已经出现在公共标准中，同时还有 Stubby 不提供的其他功能。所以 Google 在 Stubby 的基础上进行了重新设计，并利用这些标准规范将其适用性扩展到移动、物联网和云计算的应用场合。

> Google has been using a single general-purpose RPC infrastructure called Stubby to connect the large number of microservices running within and across our data centers for over a decade. Our internal systems have long embraced the microservice architecture gaining popularity today. Having a uniform, cross-platform RPC infrastructure has allowed for the rollout of fleet-wide improvements in efficiency, security, reliability and behavioral analysis critical to supporting the incredible growth seen in that period.
>
> Stubby has many great features - however, it’s not based on any standard and is too tightly coupled to our internal infrastructure to be considered suitable for public release. With the advent of SPDY, HTTP/2, and QUIC, many of these same features have appeared in public standards, together with other features that Stubby does not provide. It became clear that it was time to rework Stubby to take advantage of this standardization, and to extend its applicability to mobile, IoT, and Cloud use-cases.

因此，gRPC 为什么要使用 HTTP/2 这个问题其实本质上是在问重新设计 Stubby 时为什么要使用 SPDY/(HTTP/2)。答案也都写清楚了，没开源的 Stubby 本身就是一个通用 general-purpose、统一 unifrom、跨平台 cross-platform 的 RPC infra，而且其中很多自己造轮子的、不能公开发布的功能都已经被标准 HTTP/2 实现了，所以 gRPC 就顺理成章使用 HTTP/2 了。

## 4. 总结

1. HTTP/1.0 => HTTP/1.1：默认使用长连接，不好用的、被默认关闭的流水线 pipelining。
2. HTTP/1.x => HTTP/2：重新进行封装设计但不改变 HTTP 语义。
3. HTTP/2 来自 SPDY，gRPC 来自 Stubby。

## 参考

- [Hypertext Transfer Protocol Version 2 (HTTP/2)](https://www.rfc-editor.org/rfc/rfc7540l)
- [HPACK: Header Compression for HTTP/2](https://www.rfc-editor.org/rfc/rfc7541l)
- [HTTP 2.0 的那些事](https://segmentfault.com/a/1190000004399183) / [HTTP/2 相比 1.0 有哪些重大改进？ - victor yu的回答 - 知乎](https://www.zhihu.com/question/34074946/answer/108588042)
- [CS-Notes HTTP](https://github.com/CyC2018/CS-Notes/blob/master/notes/HTTP.md)
- [MDN HTTP/1.x 的连接管理](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Connection_management_in_HTTP_1.x)
- [详解 HTTP/2 头压缩算法 —— HPACK](https://halfrost.com/http2-header-compression/)
- [HTTP/2.0 Header Compression（下）](https://laoqingcai.com/http2-headercompression2/index.html)
- [HTTP/2.0 Flow Control](https://laoqingcai.com/http2-flowcontrol/)
- [HTTP/2.0 Stream Priority](https://laoqingcai.com/http2-streampriority/)
- [关于队头阻塞（Head-of-Line blocking），看这一篇就足够了](https://zhuanlan.zhihu.com/p/330300133)

