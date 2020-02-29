---
date: 2020-02-28
title: 'Taro 函数组件作为页面'
template: post
thumbnail: '../thumbnails/taro.png'
slug: taro-function-component
categories:
  - Tech
tags:
  - Linux
  - ExFAT
---

在了解 React Hooks 后，觉得这个写法大大弥补了函数组件的不足，于是决定多写函数组件~~练手~~。

但是在 Taro 中，因为页面配置 config 是类的实例属性，所以最开始就很迷惑应该怎么在函数组件中设置 config。。。这个 issue （[函数式组件作为页面时如何使用页面配置和页面事件处理函数 #3054](https://github.com/NervJS/taro/issues/3054)）就是在解决这个问题。

所以，现在在函数组件中，可以通过静态属性写。此外，该 issue 中也讨论到了函数组件中生命周期的问题，现在 [官方文档](https://nervjs.github.io/taro/docs/hooks.html) 中也可查阅。

```jsx
import Taro, {
  usePullDownRefresh,
} from '@tarojs/taro'

function Index() {

  usePullDownRefresh(() => {
    console.log('hello')
  })

  return (
    //...
  )
}

Index.config = {
  enablePullDownRefresh: true,
}

export default Index
```