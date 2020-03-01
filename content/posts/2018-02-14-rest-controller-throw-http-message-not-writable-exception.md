---
date: 2018-02-14
title: 'RestController 返回对象抛错 HttpMessageNotWritableException'
template: post
thumbnail: '../thumbnails/spring.png'
slug: http-message-not-writeable-exception
categories:
  - Bug
tags:
  - Web
  - Spring
---

使用 `@RestController`，理应会自动转成 json 对象，但是却抛错。

```
HttpMessageNotWritableException: No converter found for return value of type
```

可能的原因：

+ 返回的对象没有 getter 方法
+ 没有导包

```xml
<!-- https://mvnrepository.com/artifact/com.fasterxml.jackson.core/jackson-databind -->
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <version>2.9.4</version>
</dependency>
```

我是导包的问题。

### 参考

+ [https://dzone.com/articles/spring-boot-restcontroller-error-no-converter-foun](https://dzone.com/articles/spring-boot-restcontroller-error-no-converter-foun)
+ [https://stackoverflow.com/questions/32905917/how-to-return-json-data-from-spring-controller-using-responsebody](https://stackoverflow.com/questions/32905917/how-to-return-json-data-from-spring-controller-using-responsebody)