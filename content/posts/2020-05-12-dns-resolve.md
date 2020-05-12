---
date: 2020-05-12
title: 'DNS 的解析过程'
template: post
thumbnail: '../thumbnails/dns.png'
slug: dns-resolve
categories:
  - Tech
tags:
  - Reproduced
  - Web
  - DNS
---

域名是分层结构，域名DNS服务器也是对应的层级结构。有了域名结构，还需要有域名 DNS 服务器去解析域名，且是需要由遍及全世界的域名 DNS 服务器去解析，域名 DNS 服务器实际上就是装有域名系统的主机。**域名解析过程涉及 4 个 DNS 服务器**，分别如下。

| 分类           | 作用                                                         |
| :------------- | :----------------------------------------------------------- |
| 根DNS服务器    | 英文：Root nameserver。本地域名服务器在本地查询不到解析结果时，则第一步会向它进行查询，并获取顶级域名服务器的IP地址。 |
| 顶级域名服务器 | 英文：TLD (Top-level domains) nameserver。负责管理在该顶级域名服务器下注册的二级域名，例如 "example.com"，.com 则是顶级域名服务器，在向它查询时，可以返回二级域名 "example.com" 所在的权威域名服务器地址。 |
| 权威域名服务器 | 英文：Authoritative nameserver。在特定区域内具有唯一性，负责维护该区域内的域名与 IP 地址之间的对应关系，例如云解析 DNS。 |
| 本地域名服务器 | 英文：DNS resolver 或 Local DNS。本地域名服务器是响应来自客户端的递归请求，并最终跟踪直到获取到解析结果的 DNS 服务器。例如用户本机自动分配的 DNS、运营商 ISP 分配的 DNS、谷歌 / 114 公共 DNS 等。 |

1. 用户在 Web 浏览器中输入 "example.com"，则由本地域名服务器开始进行**递归查询**。
2. 本地域名服务器采用**迭代查询**的方法，向根域名服务器进行查询。
3. 根域名服务器告诉本地域名服务器，下一步应该查询的顶级域名服务器 .com TLD 的 IP 地址
4. 本地域名服务器向顶级域名服务器 .com TLD 进行查询
5. .com TLD 服务器告诉本地域名服务器，下一步查询 example.com 权威域名服务器的 IP 地址
6. 本地域名服务器向 example.com 权威域名服务器发送查询
7. example.com 权威域名服务器告诉本地域名服务器所查询的主机 IP 地址
8. 本地域名服务器最后把查询的 IP 地址响应给 Web 浏览器

## 来源

[阿里云 DNS 解析](https://help.aliyun.com/document_detail/102237.html)