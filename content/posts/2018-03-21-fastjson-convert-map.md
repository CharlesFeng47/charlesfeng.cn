---
date: 2018-03-21
title: 'FastJson 转换 Map'
template: post
thumbnail: '../thumbnails/fastjson.png'
slug: fastjson-convert-map
categories:
  - Snippet
tags:
  - Map
  - FastJson
---


```Java
Map<SeatInfo, Double> priceMap = JSON.parseObject(jsonStr, new TypeReference<HashMap<SeatInfo, Double>>() {});
```



### 参考

+ [使用fastjson将json字符串转换为Map](https://www.jianshu.com/p/a27275655e79)

