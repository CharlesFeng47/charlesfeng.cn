---
date: 2018-01-18
title: '坑爹的 rename 和 sed'
template: post
thumbnail: '../thumbnails/terminal.png'
slug: rename-and-sed
categories:
  - Snippet
  - Bug
tags:
  - Linux
---

在我电脑上的 Ubuntu 16.04.2 LTS 中

sed 的正则使用中：如需要 catch 元素`\(\)`需要使用转义符，而 rename 不要使用转义符。。

+ sed：`\(.\*\) ` 保存匹配到的字符，通过 `\1`访问 
+ rename：`(.\*) `保存匹配到的字符，通过 `\1` 或者 `\$1`（建议 `\$1`）访问

---

#### 2020-05-02 的更新

因为需要对文件批量修改，发现在 CentOS 下的 `rename` 和 Ubuntu 不同，所以记录一下。

CentOS 下 格式为 `rename stringx stringy file`，如我需要对文件日期重命名，命令即为 `rename 04-30 05-02 *`。

![](https://cdn.charlesfeng.top/images/2018-01-18-centos-rename.png)