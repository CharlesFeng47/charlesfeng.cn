---
date: 2018-01-18
title: '坑爹的rename和sed'
template: post
thumbnail: '../thumbnails/terminal.png'
slug: rename-and-sed
categories:
  - Tech
tags:
  - Linux
---

在我电脑上的Ubuntu中

sed的正则使用中：如需要catch元素`\(\)`需要使用转义符，而rename不要使用转义符。。

+ sed：\(.\*\)保存匹配到的字符，通过\1访问
+ rename：(.\*)保存匹配到的字符，通过\1或者\$1（建议\$1）访问


