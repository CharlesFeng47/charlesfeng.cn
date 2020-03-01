---
date: 2019-03-17
title: 'Vue :model 与 v-model 区别'
template: post
thumbnail: '../thumbnails/vue.png'
slug: vue-model-diff-vmodel
categories:
  - Tech
  - Snippet
tags:
  - Vue
  - Form
---

## 问题来源

这个问题来源于写 Vue 表单时没有太注意的细节。`<el-form>` 是通过 `:model` 绑定，而 `<el-input>` 是通过 `v-model` 绑定，如下面的代码所示。

<div class="filename">test.vue</div>

```html
<el-form :inline="true" :model="formInline" class="demo-form-inline">
  <el-form-item label="审批人">
    <el-input v-model="formInline.user" placeholder="审批人"></el-input>
  </el-form-item>
  <el-form-item label="活动区域">
    <el-select v-model="formInline.region" placeholder="活动区域">
      <el-option label="区域一" value="shanghai"></el-option>
      <el-option label="区域二" value="beijing"></el-option>
    </el-select>
  </el-form-item>
  <el-form-item>
    <el-button type="primary" @click="onSubmit">查询</el-button>
  </el-form-item>
</el-form>
<script>
  export default {
    data() {
      return {
        formInline: {
          user: '',
          region: ''
        }
      }
    },
    methods: {
      onSubmit() {
        console.log('submit!');
      }
    }
  }
</script>
```

根据 Vue [文档](https://cn.vuejs.org/v2/guide/forms.html)，我们可以知道 `v-model` 本质是语法糖。它只是默认帮我们绑定了 prop 和事件。

> 你可以用 `v-model` 指令在表单 `input`、`textarea` 及 `select` 元素上创建双向数据绑定。它会根据控件类型自动选取正确的方法来更新元素。尽管有些神奇，但 `v-model` 本质上不过是语法糖。它负责监听用户的输入事件以更新数据，并对一些极端场景进行一些特殊处理。
>
> `v-model` 在内部为不同的输入元素使用不同的属性并抛出不同的事件。
>
> - text 和 textarea 元素使用 `value` 属性和 `input` 事件；
> - checkbox 和 radio 使用 `checked` 属性和 `change` 事件；
> - select 字段将 `value` 作为 prop 并将 `change` 作为事件。

那为什么 `el-form` 组件只需要单向绑定 `:model`，而在 `el-input` 中需要双向绑定 `v-model` 呢？粗略看了下代码，是因为 `el-input` 是一个输入控件，需要真实地绑定、处理数据，而 `el-form` 组件只是用来管理、校验规则等，所以只需要单向绑定。之后在[这篇文章](vue-form-analysis)中，有更详细的分析、