---
date: 2018-02-14
title: 'Vue 项目中定义全局变量和全局函数'
template: post
thumbnail: '../thumbnails/vue.png'
slug: vue-global-variables-and-functions
categories:
  - Reproduced
  - Tech
tags:
  - Vue
---

## 写在前面

如题，在项目中，经常有些函数和变量是需要复用，比如说网站服务器地址，从后台拿到的用户的登录 token、地址信息等，这时候就需要设置一波全局变量和全局函数，这两个设置不太难，而且有一些共通之处，可能有一些朋友对此不太了解，所以随便写出来分享一波。

## 全局变量

#### 原理

设置一个专用的的全局变量模块文件，模块里面定义一些变量初始状态，用 `export default` 暴露出去，在 main.js 里面使用 Vue.prototype 挂载到 Vue 实例上面或者在其它地方需要使用时，引入该模块便可。

#### 定义全局变量模块文件

<div class="filename">Global.vue</div>

```html
<script>
const token='12345678';
export default {
  token,
}
</script>
```

#### 使用全局变量
##### 方式 1

在需要的地方引用进全局变量模块文件，然后通过文件里面的变量名字获取全局变量参数值。

```html
<template>
    <div>{{ token }}</div>
</template>

<script>
import global_ from '../../components/Global'//引用模块进来
export default {
  name: 'text',
  data () {
    return {
      token: global_.token,
    }
  }
}
</script>
```

##### 方式 2

在程序入口的 main.js 文件里面，将上面那个 Global.vue 文件挂载到 Vue.prototype。

<div class="filename">main.js</div>

```js
import global_ from './components/Global'
Vue.prototype.GLOBAL = global_ // 挂载
```

接着在整个项目中不需要再通过引用 Global.vue 模块文件，直接通过 this 就可以直接访问 Global 文件里面定义的全局变量。

```html
<template>
    <div>{{ token }}</div>
</template>

<script>
export default {
  name: 'text',
  data () {
    return {
      token:this.GLOBAL.token,
    }
  }
}
</script>
```

## 全局函数

#### 原理

新建一个模块文件，然后在 main.js 里面通过 Vue.prototype 将函数挂载到 Vue 实例上面。

#### 定义全局函数

##### 在 main.js 里面直接写函数

简单的函数可以直接在 main.js 里面直接写。

<div class="filename">main.js</div>

```js
Vue.prototype.changeData = function() {
  alert('执行成功');
}
```

组件中调用。

```js
this.changeData();
```
##### 定义全局函数模块文件，并挂载到 main.js 上面

<div class="filename">base.js</div>

```js
exports.install = function (Vue, options) {
  Vue.prototype.test1 = function() {
    alert('执行成功1');
  };
  Vue.prototype.test2 = function() {
    alert('执行成功2');
  };
};
```

<div class="filename">main.js</div>

```js
import base from './base'
Vue.use(base);// 将全局函数当做插件来进行注册
```

#### 使用全局函数

组件里面调用：

```js
this.text1();
this.text2();
```

## 后话

上面就是如何定义全局变量和全局函数的内容了，这里的全局变量全局函数可以不局限于 vue 项目，vue-cli 是用了 webpack 做模块化，其他模块化开发，定义全局变量、函数的套路基本上是差不多。上文只是对全局变量，全局函数的。希望看完本文能给大家一点帮助。

## 参考资料

+ [详解VUE 定义全局变量的几种实现方式](https://link.juejin.im/?target=http%3A%2F%2Fwww.jb51.net%2Farticle%2F115093.htm)
+ [Vue中如何定义全局函数](https://link.juejin.im/?target=http%3A%2F%2Fwww.jianshu.com%2Fp%2F04dffe7a6b74)
+ [Vue.use源码分析](https://link.juejin.im/?target=http%3A%2F%2Fwww.cnblogs.com%2Fdupd%2Fp%2F6716386.html)
+ [export default](https://link.juejin.im/?target=https%3A%2F%2Fsegmentfault.com%2Fq%2F1010000006854993)

## 来源

[在vue项目中定义全局变量和全局函数](https://juejin.im/post/59eddbfe6fb9a0450908abb4)