---
date: 2018-03-09
title: 'Vue 在连续界面中使用同一组件'
template: post
thumbnail: '../thumbnails/vue.png'
slug: vue-using-same-component-in-sequencial-pages
categories:
  - Bug
tags:
  - Vue
---

在[课程作业](https://github.com/CharlesFeng47/MarvelTicket)中，有一个需求是座位图。于是我使用了 GitHub 上的一个[插件](https://github.com/mateuszmarkowski/jQuery-Seat-Charts)，但这个插件是基于 jQuery 的。略去不相关的部分，座位图包括 `Step2` 修改座位图和 `Step3` 的展示座位图，但是在 `Step2` 和 `Step3` 之间进行跳转时，座位图不重新渲染。最开始以为是官方文档中在动态匹配路由章节指出的因复用了同一组件需要[响应路由参数变化](https://router.vuejs.org/zh/guide/essentials/dynamic-matching.html#%E5%93%8D%E5%BA%94%E8%B7%AF%E7%94%B1%E5%8F%82%E6%95%B0%E7%9A%84%E5%8F%98%E5%8C%96)的问题。

> 提醒一下，当使用路由参数时，例如从 `/user/foo` 导航到 `/user/bar`，**原来的组件实例会被复用**。因为两个路由都渲染同个组件，比起销毁再创建，复用则显得更加高效。**不过，这也意味着组件的生命周期钩子不会再被调用**。

但是我发现我被复用的子组件每次都会被 create，所以不是一类问题。。

我的问题是 `Step2` 和 `Step3` 使用复用的组件 `SeatChart` 的时候，只要进行了路由跳转，SeatChart 初始化了但是就是不显示。mount 的时候加载数据打印 SeatChart 区域是有东西的，然后到最后渲染出来就没了。。。。不知道什么原因。。。。怀疑是同一组件的 destroy 和 create 调用顺序问题导致初始化 SeatChart 找的那个 div 找错了，但是试验了一下发现是正确的。。所以还是不知道为什么。。`mounted` 和 `updated` 之后找此 SeatChart 所属 div 的值都找得到，但是就是到了最后界面就没了。。。。蜜汁bug。

最后，因为 `Step2` 的修改和 `Step3` 的展示 SeatChart 分别可 / 不可点击，旁边的内容也不一样，想着干脆分成两个组件好了。

后续：尝试硬分成 `SeatChart` 和 `SeatChartDisplayOnly` 两个组件，没想到还是有这个问题。。。。反正重新 mount 一次就好了。。。怀疑是这个插件的问题了。。。。

再后续：发现再加再一次就好了之后。。猥琐地将 SeatChartInit 放到 `setInterval` 中延时加载就好了。。但是时间短了（比如 10 毫秒）也不成。。。。莫名其妙。。。。。。。。

```javascript
	mounted: function() {
      var _this = this
      setTimeout(function() {
        _this.seatChartInit()
      }, 500)
    }
```

最后实现：每次加载前先手动清空之前的座位表，再重新生成。

```html
<script>
  import $ from 'jquery'

  export default {
    ...
    methods: {
      seatChartInit() {
        var _this = this
        // 需要先将之前的内容给清空，不然不会重新生成
        $('#seat-region-only').html('<div id="seat-map"></div>')
        $('#seat-map').seatCharts({
          ...
        })
      }
    }
  }
</script>
```

