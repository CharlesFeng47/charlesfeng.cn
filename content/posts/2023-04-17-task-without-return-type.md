---
date: 2023-04-17
title: '关于没有返回值的 Task 的一些思考'
template: post
thumbnail: '../thumbnails/question2.png'
slug: task-without-return-type
categories:
  - Tech
  - Thinking
tags:
  - csharp
  - task
  - async
---

## 背景

这篇文章算是从工作中学到的一点编码规范。我所在的组正在重构当前的系统，其中有一个部分是希望将所有异步的 IO 操作都包装起来，并提交给线程池统一管理。涉及到的接口简化后如下，可以看到，`IExecutionEngine` 的方法 `GetResultAsync` 包括参数上下文 `IExecutionContext` 和具体的 job `IExecutionJob`， 其中这个 job 是泛型的。方法 `GetResultAsync` 的返回结果是 `Task<TResult>`， 所以在它的实现里其实最终都是在调用 `job.ExecuteAsync()`，只是另外做了一些额外的公共操作。

```csharp
public interface IExecutionEngine
{
    Task<TResult> GetResultAsync<TResult>(IExecutionContext executionContext, IExecutionJob<TResult> job, bool throwIfFail);
}

public interface IExecutionJob<TResult>
{
    public Task<TResult> ExecuteAsync(CancellationToken cancellationToken);
    public Task<TResult> ExecuteAsync();
}
```

那，要是我这个异步操作没有返回值怎么办呢？一个直观的解决方案就是再包一层，强行返回一个带 return type 的方法。比如下方的代码就是将 `DoSomeThing()` 再包装了一层，`logic` 的类型为 `Func<Task<int>>`。

```csharp
var logic = async () =>
{
    await DoSomeThing();
    return 0;
};
```

## 避免在异步中返回 void

那为什么这个接口设计一定需要返回值呢？需要注意的是，`void` 并不是一种泛型（就像 `Action` 和 `Func<T>` 的关系），所以如果要支持 `void` 的话，我们需要再另外提供一套接口。

```csharp
public interface IExecutionEngine
{
    Task GetResultAsync(IExecutionContext executionContext, IExecutionJob job, bool throwIfFail);
}

public interface IExecutionJob
{
    public Task ExecuteAsync(CancellationToken cancellationToken);
    public Task ExecuteAsync();
}
```

这不仅仅不够优雅的问题，更深层次的原因是异步 void 方法可能在运行时导致一些问题，比如要是这个这个方法在其中抛出了异常，那么调用的线程并不会受到影响。

```csharp
using System;
using System.Threading.Tasks;
					
public class Program
{
	public static void Main()
	{
		Console.WriteLine("Hello World");
		
		RunThisAction(async () =>
		{
			await Task.Delay(1000);
			throw new NotImplementedException();
		});
	}
	
	public static String RunThisAction(Action doSomething)
	{
		doSomething();
		return "OK";
	}
}
```

## 参考

+ [Async/Await - Best Practices in Asynchronous Programming](https://learn.microsoft.com/en-us/archive/msdn-magazine/2013/march/async-await-best-practices-in-asynchronous-programming#avoid-async-void)
+ [Code Inspection: Avoid using 'async' lambda when delegate type returns 'void'](https://www.jetbrains.com/help/resharper/AsyncVoidLambda.html)
