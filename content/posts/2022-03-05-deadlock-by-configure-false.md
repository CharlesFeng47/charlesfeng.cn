---
date: 2022-03-05
title: '一次 Configure(false) 导致的死锁问题'
template: post
thumbnail: '../thumbnails/loop-triangle.png'
slug: deadlock-by-configure-false
categories:
  - Tech
  - Popular
tags:
  - csharp
  - deadlock
  - async
---

## 写在前面

写本篇文章的原因是因为自己在工作中 check in 了一个死锁问题，虽然是个 new feature 并且在联调阶段发现了，没有对线上造成什么影响，但是还是写下来引以为戒吧。另外，在 debug 搜索资料过程中发现这个问题算是一个挺经典的问题，所以更想着记录一下。

## 我是怎么引入这个死锁的？

简单抽象了一下相关代码。

我修改前的代码如下。`MethodAAsync()` 和 `MethodBAsync()` 都调用了 `client.InvokeHttpRequestAsync()` 方法，并且前后有一段逻辑是相同的，所以我将这段相同的代码抽了出来。

```csharp
public async Task MethodAAsync()
{
  ...
  await client.InvokeHttpRequestAsync().Configure(false);
  ...
  return;
}

public async Task MethodBAsync()
{
  ...
  await client.InvokeHttpRequestAsync().Configure(false);
  ...
  return;
}
```

修改后的代码如下。`MethodAAsync()` 和 `MethodBAsync()` 都调用抽出来的方法 `CommonMethodAsync`，然后由这个公共的方法去调用方法 `client.InvokeHttpRequestAsync()`。（没有那些抽出来的相同逻辑，代码看起来有点傻 😳）

```csharp
public async Task MethodAAsync()
{
  ...
  await this.CommonMethodAsync();
	...
  return;
}

public async Task MethodBAsync()
{
  ...
  await this.CommonMethodAsync();
	...
  return;
}

public async Task CommonMethodAsync()
{
  await client.InvokeHttpRequestAsync().Configure(false);
  return;
}
```

看到这里，不知道聪明的你有没有发现哪里有不同呢？诶对，我自己写的调用公共方法这里，没对它加 `.Configure(false)`，那为什么这样会导致死锁呢？

## 导致死锁的原因

其实导致出现死锁的原因是，以上这些代码最终被一层一层调用时，最上层是一个同步方法，我们省去中间那些异步调用，直接来到最上层。

```csharp
public void Get()
{
  Helper.MethodAAsync().GetAwaiter().GetResult();
  return;
}
```

当 `MethodAAsync()` 内部调用 `CommonMethodAsync()` 时，ASP.NET context 会被 captured 住，（用来在 `CommonMethodAsync()` 返回之后继续跑 `MethodAAsync()` 中的剩余代码，）然后 `MethodAAsync()` 就正常返回了一个未完成的 task。

而在上层同步调用 `MethodAAsync()` 的地方，因为它是在同步地调用异步方法，所以它会将 context thread block 在这里。

最后，`CommonMethodAsync()` 调用结束了，`MethodAAsync()` 准备继续在 context 里面跑，但是这个 context 已经在上层同步调用那里 block 住了，于是上层有 context 等 task 返回，`MethodAAsync()` 里面具体调用的地方 task 完成了但是在等 context，所以互相等待造成了死锁。

## 解决方法

#### 使所有的调用都异步

第一种方法很简单，就是让上层调用的地方也变成异步，如下所示。这样，context 就不会真的被 block 住了。

```csharp
public async Task GetAsync()
{
  await Helper.MethodAAsync();
  return;
}
```

#### 给所有异步方法都加上 `Configure(false)`

第二种方法则是给所有异步方法都加上 `Configure(false)`，这个 API 的参数名称是 `ContinueOnCapturedContext`。顾名思义，设为 false 之后它不需要在 conext 中 continue 继续跑，而是会从线程池中找一个线程 resume。这样，`MethodAAsync()` 就不需要重新进入 context，避免了跟上层同步代码的竞争。

```csharp
public async Task MethodAAsync()
{
  ...
  await this.CommonMethodAsync().Configure(false);
	...
  return;
}
```



## 参考

+ [Asynchronous : Async Await (.NET) Avoid Deadlock](https://medium.com/@rajatsikder/asynchronous-async-await-net-avoid-deadlock-4fb904d70377)
+ [Don't Block on Async Code](https://blog.stephencleary.com/2012/07/dont-block-on-async-code.html)
+ [ConfigureAwait FAQ](https://devblogs.microsoft.com/dotnet/configureawait-faq/)

