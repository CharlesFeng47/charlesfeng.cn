---
date: 2020-03-04
title: 'Intro to Headless CMS & Gatsby.js'
template: post
thumbnail: '../thumbnails/gatsby.svg'
slug: intro-to-headless-cms-and-gatsbyjs
categories:
  - Tech
tags:
  - Web
  - CMS
  - Headless CMS
  - Gatsby.js
  - Netlify
---

## 写在前面

一切的起源都来源于想换一个顺眼的博客，虽然这东西只是捣鼓着玩，但是还是可以提升自己的技术能力并总结知识的（~~以及彰显自己的乐于分享之❤️~~）。之前用的模板是 Hexo 的 [tranquilpeak](https://github.com/LouisBarranqueiro/hexo-theme-tranquilpeak)，是个人认为 Hexo 中比较顺眼的一个了，但是他的首页左右分割实在有点接受无能，以及分页跳转我个人觉得实在没有必要。。真的要找一个文章也不会一直点 `Next` 啊！所以一直有在寻觅一个比较好的替换选择。终于！被我发现了 [taniarascia](https://www.taniarascia.com/)！完美契合我的点！首页丰富好看，也没有根本鸡肋的分页功能，还提供了夜间模式、页面自适应等功能 🤩，而且因为是通过 React 写的，定制性贼高！就是你了！

在迁移过程中自然就了解到了 Netlify 和 Gatsby.js 等新技术，于是顺手学习了一波。下面我们一个一个的来看，但是在看具体的之前呢，我们需要回过头来审视一下我们的博客系统，我发现其实它也是有定义的，它也有着它的发展历程。

## CMS

首先我们先了解一下什么是 CMS，下面是维基百科的定义。

>内容管理系统（英语：content management system，缩写为 CMS）是指在一个合作模式下，用于管理工作流程的一套制度。该系统可应用于手工操作中，也可以应用到电脑或网络里。作为一种中央储存器（central repository），内容管理系统可将相关内容集中储存并具有群组管理、版本控制等功能。版本控制是内容管理系统的一个主要优势。

（是的，其实这个缩写就是这么简单。）

那什么样的网站属于 CMS 呢？其实大部分网站都可以归属于 CMS，但更多时候是指下面这些类型的网站：

- 博客类网站，以个人博客类居多；
- 公司类网站，例如[知道创宇](https://www.knownsec.com/)的网站；
- 产品类网站，比如 [Reactjs](https://reactjs.org/) 的网站。

总的来说就是指由静态化的页面组成的网站。

一直以来都有很多工具来制作或生成 CMS 网站，下面是几个比较出名的 CMS 框架。

- WordPress：老牌的 CMS 框架，以超多插件功能强大而著称，也以多安全漏洞而受广大黑客喜爱；
- GitBook：是一个支持 Markdown 格式的文档编写工具，可以很方便地和 github 进行集成；
- Hexo：是用 Nodejs 编写的博客框架，支持多种博客主题，同样支持 Markdown 格式。

## Headless CMS

是不是又一头蒙圈了哈哈。这也与 CMS 的发展有关。

传统 CMS 又常被称为巨石（monolithic） CMS 或常规（regular） CMS 或耦合式（coupled） CMS，与之相对的即为 Headless CMS。

传统的 CMS 工具在种种情况下已经无法满足用户需求，比如在集成新的传输格式方面提供足够的灵活性等。而随着时代的进步、社会的发展（最初似乎是因为物联网 IoT 的需求，据[参考文章](#%E5%8F%82%E8%80%83) 4 和 5），大家对 Headless CMS 的需求也越来越高，因为在传统 CMS 上进行相应修改时很可能是一项不小的挑战。

术语「Headless」指的是不要前端，然后通过 API 将内容发布到设备来展示。Headless CMS 的不要前端是将「Head」（如网站前端）与「Body」（如内容仓库后端）分离解耦开，这样，Headless CMS 并不关心内容的显示方式和位置，它仅关注一个重点——存储和交付结构化内容。

不同于传统 CMS，仅使用 Headless CMS 是不能构成一个完整网站的。（因为没有 Head 啊！）所以还需要为网站创建一个 Head，这似乎是一项艰巨任务，但是通过将 CMS 与前端分离，开发人员可以选择他们已经熟悉的任何技术，而无需学习特定 CMS 的技术。 另一个巨大的好处是，开发人员可以更加专注于自己的工作，而无需处理 CMS 后端中的现有 bug。因此，更容易为 Google 的 Pagespeed 优化页面，甚至无需关心 CMS 中的内容就可以 relaunch 网站内容。

更多可以参照 [headlesscms](https://headlesscms.org/)，对各种 Headless CMS 的使用情况进行了横向比较。

#### Features of Headless CMS

+ 对内容进行建模，创建和授权；
+ 管理内容的存储库 repository；
+ 改善工作流和协作；
+ 多语言；
+ 高级图像管理；
+ 各种 asset 管理；
+ 访问控制。

#### Benefits of Headless CMS

+ 灵活性：传统 CMS 局限太强，并且可能不那么令人满意。使用 Headless CMS 将使您可以设计前端。此外，它带有定义明确的 API，因此，可以花更多时间在创作内容上，而不是对其进行管理；
+ 兼容：您可以将内容发布到任何智能设备，同时可以从一台设备控制后端；
+ 安全：由于无法从数据库访问内容发布环境，因此可以防止恶意软件攻击；
+ 可扩展：由于前端和后端是分开的，因此不需要单独的维护时间，这使您可以随时自定义网站，而不必牺牲性能；
+ 控制：它没有任何规则，并且给了开发人员完全的控制权限。开发人员将能够与任何代码库集成，也可以选择任何喜欢的语言进行开发。

具体来说，传统如 WordPress 之流还是使用 php 和 HTML 混写，写起来不爽，并且很难对显示进行定制（如修改  theme），但是有时因为 WordPress 上面东西太多懒得迁移、或者需要使用 WordPress 中一些比较成熟的插件等种种原因，就使用它提供的 RESTful API，重做一个前端来获取数据，定制一个新的博客，增加新的功能，甚至（通过现代 JS 框架的强大功能）提供 WordPress 不可能提供的功能，这样它就变成了一个 Headless CMS 🙇🏻‍♂️。

因此，在 Headless CMS 的情况下，我们希望对前端进行更好地展现。而因为 React 是全球范围内最受欢迎的前端框架，自然而然希望可以有一个基于 React 技术的静态网站开发工具，这便是 Gatsby.js。

## Gatsby.js

先来看看 Gatsby.js 对自己的定位。

> Gatsby is a free and open source framework based on React that helps developers build blazing fast **websites** and **apps**

它是一个基于 React 的免费开源的框架，可以用来快速构建网站和 app。具体的说明就还是看[文档](https://www.gatsbyjs.org/docs/)叭，虽然它文档真的比较长。。

列一下其中几个比较常用的配置。

- `/gatsby-config.js` 
  - `siteMetadata` 放一些全局信息，这些信息在每个页面都可以通过 GraphQL 获取到。
  - `plugins` 配置插件，这个按用到时按该插件文档说明弄即可。
- `/gatsby-node.js` 可以调用 [Gatsby node APIs](https://www.gatsbyjs.org/docs/node-apis/) 干一些自动化的东西。一般有两个常用场景。
  - 添加额外的配置，比如为 Markdown 文章生成自定义路径。
  - 生成 `/src/pages` 以外的页面文件，如为每个 Markdown 文章生成页面文件。
- `/gatsby-browser.js` 可以调用 [Gatsby browser APIs](https://www.gatsbyjs.org/docs/browser-apis/)。

## Netlify

Netlify 是一个在此语境（Headless CMS + Gatsby.js）下常被提到的工具，因此也在这里做下介绍。同样地，我们先来看看 Netlify 对自己的定位。

> The fastest way to build the fastest sites: Build, test, and deploy globally with Netlify’s all-in-one platform for modern web projects.

可以看出，Netlify 强调快！他可以在一个一站式平台中编译、测试、部署现代化 web 项目。

因为其极其简单的特性，所以它往往被用来作为一个提供静态资源网络托管的综合平台。相较于 Hexo 使用的 `GitHub Page`，`Netlify` 的优点在[官网](https://www.netlify.com/github-pages-vs-netlify/)也作了说明。

- 一键 rollback；
- asset 优化：如 CSS 和 JS 的优化、图片的压缩；
- 部署前预览；
- 持续部署：当你提交改变到 Git 仓库，它就会自动运行 build command，进行自动部署；
- Split Testing：（目前还是 Beta 版本）官网的说法是可以直接从 Netlify 的 CDN 网络中将流量分配到不同部署之间，而不损失任何下载性能，也无需安装任何第三方 JavaScript 库。 所以可以将其用于 A / B 测试或启动私人 Beta 版。~~不过还没有试过~~；
- 可以添加自定义二级域名；
- Http headers：可以定制资源的 `http header`，从而可以做**缓存优化**等；
- 免费的 CDN：把静态资源推到 CDN（虽然是国外的）；
- 可以一键使用 Let's Encrypt 的免费 TLS 证书，启用 HTTPS。

因为国内网络的问题，访问有点慢。。以及，我一个小的 Gatsby.js 项目，居然要编译 5 分钟，实在对不起他的标语。。但是怎么说呢，使用确实简单，这样一个简简单单的前端静态项目，不说 Jenkins，即使是 Travis 来自动部署也觉得重，Netlify 提供了一种更简便、更省心的选择。

## 总结

Headless CMS 可以在保留原有 CMS 强大的编辑能力（如富文本编辑、图片格式调整等）的情况下提供 RESTful API，在避免全部推到重来的情况下呈现一个更现代的网站。

Gatsby.js 就是其中翘楚，它使用 React 技术来构建静态网站或 App 的框架，但是往往被大家用来用来构建静态博客网站哈哈。它可以从 Headless CMS 系统如 [Contentful](https://app.contentful.com/) 中获取数据并展示，下图所示的即为 [gatsby-contentful-starter](https://www.gatsbyjs.org/starters/contentful-userland/gatsby-contentful-starter/) 的构建结果，在 Contentful 中可以看到所有的文章内容，如下所示。

![](https://images.charlesfeng.cn/2020-03-04-1.jpg)

此外，在编辑界面可以看到他的富文本编辑器，可以提供更加强大的编辑功能。

![](https://images.charlesfeng.cn/2020-03-04-2.jpg)

而 Netlify 则是一个极其简单、方便的静态资源托管网站，支持持续集成、一键 HTTPS 等方便的功能。

## 参考

+ [基于 React 的 CMS 框架对比：Docusaurus vs. Gatsby](https://zhaozhiming.github.io/blog/2018/01/30/docusaurus-vs-gatsby/)
+ [Headless CMS + React](https://www.v2ex.com/t/597779)
+ [使用 Netlify 部署你的前端应用](https://juejin.im/post/5dc360205188255f6d42bd6f#heading-7)
+ [10 Headless CMS to Consider for Modern Application](https://geekflare.com/headless-cms/)
+ [24 Headless CMS That Should Be On Your Radar in 2019](https://www.cmswire.com/web-cms/13-headless-cmss-to-put-on-your-radar/)
+ [Headless CMS explained in 5 minutes](https://www.storyblok.com/tp/headless-cms-explained)
+ [Serverless Content Management Systems](https://serverless.css-tricks.com/services/cmss/)

