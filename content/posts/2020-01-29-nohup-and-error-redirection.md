---
date: 2020-01-29
title: 'nohup & 与 2>&1'
template: post
thumbnail: '../thumbnails/terminal.png'
slug: nohup-and-error-redirection
categories:
  - Tech
tags:
  - Reproduced
  - Linux
---

## 原因

当我们在终端或控制台工作时，可能不希望由于运行一个作业而占住了屏幕，因为可能还有更重要的事情要做，比如阅读电子邮件。对于密集访问磁盘的进程，我们更希望它能够在每天的非负荷高峰时间段运行（例如凌晨）。为了使这些进程能够在后台运行，也就是说不在终端屏幕上运行，有几种选择方法可供使用。

## &
**当在前台运行某个作业时，终端被该作业占据；可以在命令后面加上 `&` 实现后台运行。（以 job 的方式）**例如：

```shell
sh test.sh &
```

适合在后台运行的命令有 find、费时的排序及一些 shell 脚本。在后台运行作业时要当心：需要用户交互的命令不要放在后台执行，因为这样你的机器就会在那里傻等。不过，作业在后台运行一样会将结果输出到屏幕上，干扰你的工作。如果放在后台运行的作业会产生大量的输出，最好使用下面的方法把它的输出重定向到某个文件中：

```shell
command > out.file 2>&1 & 
```

这样，所有的标准输出和错误输出都将被重定向到一个叫做 out.file 的文件中。

## nuhup

使用 `&` 命令后，作业被提交到后台运行，当前控制台没有被占用，但是一但把当前控制台关掉（退出帐户时），作业就会停止运行。**`nohup` 命令可以在你退出帐户之后继续运行相应的进程。nohup 就是不挂起的意思（no hang up）。**该命令的一般形式为：

```shell
nohup command &
```

如果使用 `nohup` 命令提交作业，那么在缺省情况下该作业的所有输出都被重定向到一个名为 nohup.out 的文件中，除非另外指定了输出文件：

```shell
nohup command > myout.file 2>&1 &
```

使用了 `nohup` 之后，很多人就这样不管了，其实这样有可能在当前账户非正常退出或者结束的时候，命令还是自己结束了。**所以在使用 `nohup` 命令后台运行命令之后，需要使用 `exit` 正常退出当前账户，这样才能保证命令一直在后台运行。**

+ `Ctrl+c`：终止前台命令。
+ `jobs`：查看当前有多少在后台运行的命令。`jobs -l` 选项可显示所有任务的 PID，jobs 的状态可以是 running、stopped、Terminated。但是如果任务被终止了（kill），shell 从当前的 shell 环境已知的列表中删除任务的进程标识。

## 2>&1

`2>&1` 是将标准出错重定向到标准输出，这里的标准输出已经重定向到了 out.file 文件，即将标准出错也输出到 out.file 文件中。

试想 `2>1` 代表什么，2 与 > 结合代表错误重定向，而 1 则代表错误重定向到一个文件 1，而不代表标准输出；换成 `2>&1`，& 与 1 结合就代表标准输出了，就变成错误重定向到标准输出。

## 来源

版权声明：本文为CSDN博主「liuyanfeier」的原创文章，遵循 CC 4.0 BY-SA 版权协议，转载请附上原文出处链接及本声明。原文链接：<a href='https://blog.csdn.net/liuyanfeier/article/details/62422742' target="_blank" rel="noopener noreferrer">https://blog.csdn.net/liuyanfeier/article/details/62422742</a>

