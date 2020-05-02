---
date: 2020-05-01
title: '多个 Server 时的 Nginx 配置'
template: post
thumbnail: '../thumbnails/nginx.png'
slug: nginx-conf-multi-server
categories:
  - Tech
  - Snippet
tags:
  - Nginx
---

Nginx 支持将不同 server 的配置提取到不同的文件中，只需要在默认配置文件中包含各文件即可。而默认配置文件 /etc/nginx/nginx.conf 中默认 `include /etc/nginx/conf.d/*.conf`，即包含了 conf.d 目录下的所有配置文件。在我的例子中，conf.d 目录下包含两个网站的配置文件，各自配置了 access_log，以方便日后查看。

Nginx 还支持对同一个端口进行监听，并通过 server_name 进行区分。在我的例子中，也可以看到 server_name 的不同。

![](https://cdn.charlesfeng.top/images/2020-05-01-nginx-conf.png)

此外，因为对 charlesfeng.cn 进行备案，阿里云会对之前备案的域名进行检查，底部是否添加备案号并链接到工信部，所以 charlesfeng.conf 中最下方的配置是为之前备案的域名 charlesfeng.top 提供一个默认界面并添加备案哈，以通过审核 =。=

