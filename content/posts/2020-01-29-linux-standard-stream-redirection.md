---
date: 2020-01-29
title: 'Linux 重定向'
template: post
thumbnail: '../thumbnails/terminal.png'
slug: linux-standard-stream-redirection
categories:
  - Tech
tags:
  - Reproduced
  - Linux
---



There are, by default, three "standard" files open when you run a program, standard input (`stdin`), standard output (`stdout`), and standard error (`stderr`). In Unix, those are associated with "file descriptors" (`stdin` = 0, `stdout` = 1, `stderr` = 2). By default, all three are associated with the device that controls your terminal (the interface through which you see content on screen and type input into the program).

The shell gives you the ability to "redirect" file descriptors. The `>` operator redirects output; the `<` redirects input.

For example:

```shell
program_name > /dev/null
```

Which is equivalent to:

```shell
program_name 1> /dev/null
```

Redirects the output to file descriptor 1 ('stdout') to '/dev/null'

Similarlly,

```shell
program_name 2> /dev/null
```

Redirects the output to file descriptor 2 ('stderr') to '/dev/null'

You might want to redirect *both* `stdout` and `stderr` to a single file, so you might think you'd do:

```shell
program_name > /dev/null 2> /dev/null
```

But that doesn't handle interleaving writes to the file descriptors (the details behind this are a different question). To address this, you can do:

```shell
program_name > /dev/null 2>&1
```

Which says "redirect writes to file descriptor 1 to `/dev/null` and redirect writes to file descriptor 2 to the same place as the writes to file descriptor 1 are going". This handles interleaving writes to the file descriptors.

That option is so common that some shells include a short-hand that is shorter and functionally equivalent:

```shell
program_name &> /dev/null
```

Finally, you can redirect input in the same way that you redirect output:

```shell
program_name < /dev/null
```

Will redirect file descriptor 0 (`stdin`) from `/dev/null`, so if the program tries to read input, it'll get EOF.

Putting that all together:

```shell
program_name </dev/null &>/dev/null &
```

Say (1) run `program_name`, (2) redirect standard input from `/dev/null` (`</dev/null`), (3) redirect both file descriptors 1 and 2 (`stdout` and `stderr`) to `/dev/null` (`&>/dev/null`), and (4) run the program in the background (`&`).

## 总结

1. `program_name > /dev/null 2> /dev/null` == `program_name > /dev/null 2>&1` == `program_name &> /dev/null`，同时重定向标准输出和错误输出
2. `program_name < /dev/null &> /dev/null` 同时重定向标准输入、标准输出和错误输出。所以当程序想要读取数据时，从空设备中获得 EOF。



## 来源

[difference-between-dev-null-21-and-dev-null-dev-null](https://unix.stackexchange.com/questions/497207/difference-between-dev-null-21-and-dev-null-dev-null)