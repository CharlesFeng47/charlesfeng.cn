---
date: 2020-01-29
title: 'dev-null 与 dev-zero'
template: post
thumbnail: '../thumbnails/terminal.png'
slug: dev-null-and-dev-zero
categories:
  - Reproduced
  - Tech
tags:
  - Linux
---

## /dev/null

在类 Unix 系统中，/dev/null 或称空设备，是一个特殊的设备文件，它丢弃一切写入其中的数据（但报告写入操作成功），读取它则会立即得到一个 EOF。
在程序员行话，尤其是 Unix 行话中，/dev/null 被称为位桶（bit bucket）或者黑洞（black hole）。空设备通常被用于丢弃不需要的输出流，或作为用于输入流的空文件。这些操作通常由重定向完成。

#### 日常使用

##### 1. 测试命令运行状态

把 /dev/null 看作“黑洞”。它等价于一个只写文件，并且所有写入它的内容都会永远丢失，而尝试从它那儿读取内容则什么也读不到。然而，/dev/null 对命令行和脚本都非常的有用。

有些时候，我并不想看道任何输出，我只想看到这条命令运行是不是正常，那么我们可以同时禁止标准输出和标准错误的输出:    

```shell
cat filename 2>/dev/null >/dev/null
```

所以：

* 如果"$filename"不存在，将不会有任何错误信息提示，
* 如果"$filename"存在，文件的内容不会打印到标准输出。
* 因此, 上面的代码根本不会输出任何信息，当只想测试命令的退出码而不想有任何输出时非常有用。
* 下一步，我们使用 `echo $?` 查看上条命令的退出码：0为命令正常执行，1-255为有出错。

##### 2. 清空文件内容

有时候，我们需要删除一些文件的内容而不删除文件本身。

```shell
cat /dev/null > /var/log/messages
```

或

```shell
: > /var/log/messages
```

有同样的效果，但不会产生新的进程。（因为 `:` 是内建的）

## /dev/zero

在类 UNIX  操作系统中，/dev/zero 是一个特殊的文件，当你读它的时候，它会提供无限的空字符（NULL, ASCII NUL, 0x00）。

其中的一个典型用法是用它提供的字符流来覆盖信息，另一个常见用法是产生一个特定大小的空白文件。BSD 就是通过 mmap 把 /dev/zero 映射到虚地址空间实现共享内存的。可以使用 mmap将 /dev/zero 映射到一个虚拟的内存空间，这个操作的效果等同于使用一段匿名的内存（没有和任何文件相关）。

#### 日常使用

##### 1. 临时交换文件

像 /dev/null 一样，/dev/zero 也是一个伪文件，但它实际上产生连续不断的 null 的流（二进制的零流，而不是 ASCII 型的）。写入它的输出会丢失不见，/dev/zero 主要的用处是用来创建一个指定长度用于初始化的空文件，像临时交换文件。

```shell
dd if=/dev/zero of=/dev/sdb bs=4M
```

最后值得一提的是，ELF二进制文件利用了/dev/zero。



## 来源
版权声明：本文为CSDN博主「i龙家小少」的原创文章，遵循 CC 4.0 BY-SA 版权协议，转载请附上原文出处链接及本声明。原文链接：https://blog.csdn.net/longerzone/article/details/12948925

