---
date: 2023-05-21
title: 'Struct 的内存分配及在实际应用中的一个栗子'
template: post
thumbnail: '../thumbnails/loop.png'
slug: how-to-allocate-for-struct-and-an-example
categories:
  - Tech
tags:
  - csharp
  - struct
  - class
  - data structure
---

## 背景

写这篇文章的起因也蛮有意思，而且从中学到了新东西，所以也记录一下。

我组对内存中 memory cache 里面记录的东西会每隔一小时统计一次，统计的东西包括各个 App 使用的 cache 条数、negative cache 条数以及所占的字节大小。统计完之后再打点上传 Geneva。

在之前的实现中，我们用了两个成员变量来实现，一个是包含具体 cache 内容的 ConcurrentDictionary `applicationCache`，另一个 ConcurrentDictionary `applicationCacheSizeInBytes` 则是会实时计算占用的字节数，在 `applicationCache` 被更新的地方都会相应变更 `applicationCacheSizeInBytes`。从中可以看到，`CacheSizeMetric` 打点 negative cache 和 all cache 是通过遍历 `applicationCache` 实现的，而 `CacheSizeBytesMetric` 的打点则是直接与 `applicationCacheSizeInBytes` 相关。

```csharp
private ConcurrentDictionary<string, ExactTimeoutCache<string, string>> applicationCache = new ConcurrentDictionary<string, ExactTimeoutCache<string, string>>(StringComparer.InvariantCultureIgnoreCase);

private ConcurrentDictionary<CacheSizeContext, long> applicationCacheSizeInBytes = new ConcurrentDictionary<CacheSizeContext, long>();

public void UploadCacheSizeSignalToGeneva(object sender)
{
    foreach (var cacheKeyValuePair in this.applicationCache)
    {
        var cacheValues = cacheKeyValuePair.Value.Values;

        // Counting the negative entries requires checking each entry, but since this is done infrequently and the cache size is bounded,
        // we count it here instead of maintaining a count during runtime
        int numNegativeCacheEntries = cacheValues.Count(string.IsNullOrEmpty);
        CacheSizeMetric.Log(numNegativeCacheEntries, cacheKeyValuePair.Key, CacheEntryType.Negative);
        CacheSizeMetric.Log(cacheValues.Count, cacheKeyValuePair.Key, CacheSizeMetric.CacheEntryType.All);
    }

    if (CacheSizeBytesMetricEnabled)
    {
        foreach (var cacheKeyValuePair in this.applicationCacheSizeInBytes)
        {
            var cacheSizeContext = cacheKeyValuePair.Key;
            var cacheSizeInBytes = cacheKeyValuePair.Value;
            CacheSizeBytesMetric.Log(cacheSizeInBytes, cacheSizeContext.AppId, cacheSizeContext.ShardId);
        }
    }
}
```

修改后的代码如下。`applicationCache` 与打点解耦，只与具体的 cache 内容相关。另一个 ConcurrentDictionary `applicationCacheSizeInBytes` 的 value 则从简单的 `long` （只单纯记录字节大小） 变成了 `CacheSize` （同时更新 cache 条数、negative cache 条数和占用的具体字节数），所以命名也修改为了更合适的 `cacheSizeTracker`。方法 `UploadCacheSizeSignalToGeneva` 的新实现中，就只需要遍历 `cacheSizeTracker`，而与 cache data 无关。

需要注意的是，这里引入的 `CacheSize` 是一个 **struct** 而非 class。

```csharp
private ConcurrentDictionary<string, ExactTimeoutCache<string, string>> applicationCache = new ConcurrentDictionary<string, ExactTimeoutCache<string, string>>(StringComparer.InvariantCultureIgnoreCase);

private ConcurrentDictionary<CacheSizeContext, CacheSize> cacheSizeTracker = new ConcurrentDictionary<CacheSizeContext, CacheSize>();

public void UploadCacheSizeSignalToGeneva(object sender)
{
    foreach (var cacheKeyValuePair in this.cacheSizeTracker)
    {
        var cacheSizeContext = cacheKeyValuePair.Key;
        var cacheSize = cacheKeyValuePair.Value;
        CacheSizeMetric.Log(cacheSize.CountPositive + cacheSize.CountNegative, cacheSizeContext.AppId, cacheSizeContext.ShardId, CacheSizeMetric.CacheEntryType.All);
        CacheSizeMetric.Log(cacheSize.CountNegative, cacheSizeContext.AppId, cacheSizeContext.ShardId, CacheSizeMetric.CacheEntryType.Negative);
        CacheSizeBytesMetric.Log(cacheSize.SizeInBytes, cacheSizeContext.AppId, cacheSizeContext.ShardId);
    }
}

/// <summary>
/// Contains various properties describing the size of the cache.
/// </summary>
private readonly struct CacheSize
{
    public readonly int CountPositive;
    public readonly int CountNegative;
    public readonly long SizeInBytes;

    public CacheSize(int countPositive, int countNegative, long sizeInBytes)
    {
        this.CountPositive = countPositive;
        this.CountNegative = countNegative;
        this.SizeInBytes = sizeInBytes;
    }

    public static CacheSize operator +(CacheSize a, CacheSize b)
    {
        return new CacheSize(
            a.CountPositive + b.CountPositive,
            a.CountNegative + b.CountNegative,
            a.SizeInBytes + b.SizeInBytes);
    }
}
```

## Struct VS Class

因此，我提出的第一个疑问是，（当时没注意到 `CacheSize` 是一个 struct，）这样每次 cache 更新都顺便更新  `cacheSizeTracker`，不会导致生成很多小对象，从而导致 performance issue 吗？然后同事指出了这个是 struct 而非 class，所以不会。

但我还是不太理解这里的 struct 是怎么处理的，因为按我当时的理解（死记硬背 😧），struct 应该在栈上被分配内存，可是这个在成员变量里面，怎么办呢？同事指出 struct 是值类型 value type，但它并不一定存储在栈上。如果是局部变量，那可以在栈上；但是如果是引用类型 reference type 的一部分的话，（比如在一个 array 里，或者作为一个类的成员变量，）则会被存储到堆上。这也是本篇学习到最重要的一点，**value type 更重要的是它的语义，而非在哪里被分配**。

最后是一点对 `ConcurrentDictionary<CacheSizeContext, CacheSize> cacheSizeTracker` 更具体的讨论。因为 Dictionary 会因为元素的数量 resize，所以我觉得是不是默认给一个更大的 size 会更好，以避免频繁的扩容，尤其是当里面的元素是 struct，每扩容一次，都得把所有元素拷贝一遍到新的 Dictionary。同事觉得因为目前我们也不知道具体有多少条，所以先这样吧 😬，以避免分配太多无用的内存造成浪费。

## Stack Is An Implementation Detail

最后，针对新学到的这一点，我发现微软的[官方博客](https://learn.microsoft.com/en-us/archive/blogs/ericlippert/the-stack-is-an-implementation-detail-part-one)也对其有着补充说明。

描述C#内存模型语义时，通常将“引用”描述为“地址”。尽管这个描述在某种程度上是正确的，但也可以说它更像是一种实现细节，而不是一个重要的永恒真理。我经常看到另一个内存模型实现细节被呈现为事实的情况是“值类型在堆栈上分配”。我之所以经常看到这个是因为当然，这是我们的[文档](https://learn.microsoft.com/en-us/dotnet/api/system.valuetype)中所说的。

> Data types are separated into value types and reference types. Value types are either stack-allocated or allocated inline in a structure. Reference types are heap-allocated.

我几乎每篇文章都会看到，其中描述了值类型和引用类型之间的区别，并详细解释了“堆栈”的含义，以及值类型和引用类型之间的主要区别是值类型放在堆栈上。我相信您可以通过在网上搜索找到数十个这样的例子。

根据 value type 的实现细节而不是可观察特征来对其进行描述，既令人困惑又不幸。值类型最相关的事实当然不是它们分配的实现细节，而是 value type 的设计语义，即它们总是通过“按值”复制。如果相关的是它们的分配细节，那么我们本应该称它们为“堆类型 heap types”和“栈类型 stack types”。但在大多数情况下，这并不重要。大多数情况下，重要的是它们的复制和标识语义。

正如MSDN文档正确指出的那样，value type **有时**会在栈 stack 上分配。例如，一个 class 的一个整数字段的内存是该类实例的一部分，并在堆上分配。如果局部变量是匿名方法中使用的外部变量，则该局部变量将被提升为作为隐藏类的字段来实现，因此如果它是值类型，与该局部变量关联的存储将位于堆上。

事实上，并没有要求CLI所实现的操作系统必须提供一个名为“堆栈”的每个线程一兆字节数组。Windows通常会提供这样的结构，并且这个一兆字节数组是存储少量短生命周期数据的高效位置，这很好，但并没有规定操作系统必须提供这样的结构，或者JIT编译器必须使用它。只要维护了值类型语义，JIT编译器可以选择将每个局部变量“放在堆上”，并承担这样做的性能成本。

更糟糕的是，经常看到的是将值类型描述为“小而快”，将引用类型描述为“大而慢”。确实，可以JIT编译为从堆栈分配的代码的值类型在分配和释放方面非常快速。堆分配的大型结构，例如值类型数组，也相当快，特别是如果需要将它们初始化为值类型的默认状态。而且引用类型会带来一些内存开销。还有一些高调的情况，值类型提供了显著的性能优势。但在绝大多数程序中，局部变量的分配和释放不会成为性能瓶颈。

对于一个类型，将其从本来应该是引用类型变成值类型，以获取几个纳秒的性能收益，这种微观优化可能并不值得。我只会在分析数据显示存在一个大的、真实的、影响客户性能的问题，并且使用值类型可以直接缓解这个问题的情况下才会做出这样的选择。如果没有这样的数据，我会始终根据类型是否在语义上表示一个值或在语义上表示对某些东西的引用来选择值类型或引用类型。



---

GC具有大量精心调整的策略，以确保高性能；它试图平衡堆中内存和时间成本，以避免出现瑞士奶酪状的堆，而不用进行压缩阶段的高成本操作。极大的对象存储在具有不同压缩策略的特殊堆中。等等。我不知道所有的细节，幸运的是，我也不需要知道。（当然，我忽略了一些与本文无关的其他复杂性 - 固定、终结和弱引用等等。）

现在，将其与堆栈进行比较。堆栈与堆相似，因为它是一个大块内存，具有“高水位标记”。但使其成为“堆栈”的是堆栈底部的内存总是比堆栈顶部的内存寿命更长；堆栈是严格有序的。将首先死亡的对象位于顶部，将最后死亡的对象位于底部。借助这一保证，我们知道堆栈永远不会有空洞，因此不需要压缩。我们知道堆栈内存将始终从顶部“释放”，因此不需要空闲列表。我们知道堆栈上的低层内存保证是活的，因此我们不需要标记或清理。

在堆栈上，分配只是一个单一的指针移动 - 与堆上的最佳（和典型）情况相同。但由于所有这些保证，释放也是一个单一的指针移动！这就是巨大的性能节省之处。许多人似乎认为堆分配很昂贵，而堆栈分配很便宜。实际上，它们通常是相似的。差别在于释放成本 - 标记、清理、压缩和将内存从一代移动到另一代的成本在堆内存相对于堆栈内存而言是巨大的。

很明显，如果可以的话，最好使用堆栈而不是GC堆。什么时候可以使用堆栈呢？只有在可以保证实际满足使堆栈正常工作的所有必要条件的情况下。值类型的局部变量和形式参数是实现这一点的最佳选择。堆栈底部框架的局部变量明显寿命比堆栈顶部框架的局部变量长。值类型的局部变量按值复制，而不是按引用复制，因此局部变量是唯一引用内存的东西；无需跟踪谁引用特定值来确定其生存期。而且，获取局部变量的引用的唯一方法是将其作为引用或输出参数传递，这只是将引用传递给堆栈上面。局部变量无论如何都会存活，所以对它“更高层次”的调用堆栈中有引用并不会改变它的生命周期。



所以，这就是答案。值类型的局部变量之所以存储在堆栈上，是因为它们可以。它们之所以可以，是因为（1）“普通”局部变量具有严格的生存期排序，（2）值类型总是按值复制，以及（3）在任何可能比局部变量更长寿的地方存储对局部变量的引用是非法的。相比之下，引用类型的寿命基于活动引用的数量，按引用复制，并且这些引用可以存储在任何地方。引用类型提供的额外灵活性伴随着更复杂和昂贵的垃圾回收策略而来。

但再次强调，所有这些都是实现细节。在值类型的局部变量中使用堆栈只是CLR为您执行的一种优化。值类型的相关特性是**它们具有按值复制的语义**，而不是**有时它们的释放可以被运行时优化**。

## 参考

+ [Saving Memory with C# Structs](http://clarkkromenaker.com/post/csharp-structs/)
+ [The Stack Is An Implementation Detail, Part One](https://learn.microsoft.com/en-us/archive/blogs/ericlippert/the-stack-is-an-implementation-detail-part-one)
+ [The Stack Is An Implementation Detail, Part Two](https://learn.microsoft.com/en-us/archive/blogs/ericlippert/the-stack-is-an-implementation-detail-part-two)
