---
date: 2018-06-24
title: 'Vue keep-alive 注意点'
template: post
thumbnail: '../thumbnails/vue.png'
slug: vue-keep-alive
categories:
  - Tech
tags:
  - Vue
---

需要正确理解缓存之后，路径变化时生命周期钩子的调用。

> 当引入 `keep-alive` 的时候，页面第一次进入，钩子的触发顺序 created -> mounted -> activated，退出时触发 deactivated。当再次进入（前进或者后退）时，只触发 activated。
>
> 我们知道 `keep-alive` 之后页面模板第一次初始化解析变成 HTML 片段后，再次进入就不在重新解析而是读取内存中的数据，即，只有当数据变化时，才使用 VirtualDOM 进行 diff 更新。故，页面进入的数据获取应该在 activated 中也放一份。数据下载完毕手动操作 DOM 的部分也应该在 activated 中执行才会生效。
>
> 所以，应该 activated 中留一份数据获取的代码，或者不要 created 部分，直接将 created 中的代码转移到 activated 中。

### 来源

[Vue路由开启keep-alive时的注意点](https://www.jianshu.com/p/42429f4d8f9e)