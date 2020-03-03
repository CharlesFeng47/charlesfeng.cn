---
date: 2018-05-22
title: 'Appium 进阶使用 UIAutomator'
template: post
thumbnail: '../thumbnails/appium.png'
slug: appium-uiautomator
categories:
  - Reproduced
  - Snippet
tags:
  - Appium
  - Test
  - Android
---

## 第一式 多属性联合查询定位

> 当我们遇到一个元素，它没有唯一的 ID、Text、ClassName 等明显标记可以唯一确定它的时候，往往需要联合该元素的多个属性来唯一确定它的位置。

**场景**：假设页面 A 为导航页，该页面全部的元素都是由 ImageView 组成，包括上面唯一可点击的按钮「跳过」，都是一个 ImageView 空控件，这些 IV 控件没有任何 ID、Text 标记，那我们怎么点击到「跳过」这个IV控件呢？

有同学可能会说，获取这个页面的所有IV控件，然后通过序号的方式去点击。ok，这是一种解决方案。但是并不完美。

我们打开 `uiautomatorviewer` 来分析一下这个场景，布局上全都是 `ImageView` 控件，没有 ID等易于区分的信息。但是我们能够从上面发现，「跳过」这个控件有另外一个特点，它的 `clickable` 属性是 True，其他的 IV 却都是 False。 这说明**它是这个页面中所有ImageView控件中唯一一个可点击的**。

所以这就是我们的切入点。那么我们怎么将这两个属性组合起来查询？

我们可以直接使用UIAutomator的方式：

```Java
//UiAutomator原生的定位方式
UiObject iv = new UiObject(new UiSelecor().className("android.widget.ImageView").clickable(true);
iv.click();
```

那在Appium里的实现就是：

```Java
WebElement iv = driver.findElementByAndroidUIAutomator("new UiSelector().className(\"android.widget.ImageView\").clickable(true)");
iv.click();
```

> 这里需要特别说明的是，`findElementByAndroidUIAutomator` 方法获取的对象就是 `UiObject` 本身，所以是写法如上。

## 第二式 ListView自动搜索查询

> 当我们碰到很长的 ListView，且需要在这个 ListView 里面查询指定的元素的时候。我们如何做呢？生硬的 swipe + findElement 适用吗？

**场景：在班级列表中找到带有上课中字样的选项，然后点击。**

常见的 `swipe` 滑动 List，然后 `findelement` 找到指定的元素，这个方式也是可用的，但是实在不稳定，因为我们不能确定到底滑动多少次，才进行元素点击，也不知道什么时候才滑动到了最后。所以这个方法是不可行的。

**正确的方法：**

```Java
//UiAutomator原生
//此方法的含义是先获取当前页面可滑动的元素，然后在这个元素的基础上，找到包含`上课中`这三个字的项目，再点击。
UiObject cl = new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().textContains("上课中"));
cl.clickt()
```

那么，在Appium中的写法就是：

```Java
WebElement cl = driver.findElementByAndroidUIAutomator("new UiScrollable(new UiSelector().scrollable(true)).scrollIntoView(new UiSelector().textContains(\"上课中\"))");
cl.click()
```

快去尝试一下吧。

相关资料：<http://developer.android.com/intl/zh-cn/tools/testing-support-library/index.html>



### 来源

[进阶之UIAutomator](https://anikikun.gitbooks.io/appium-girls-tutorial/content/Up_uiautomator.html)