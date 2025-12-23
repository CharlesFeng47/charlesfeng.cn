---
date: 2020-07-21
title: '如何实现一个 Fluent API'
template: post
thumbnail: '../thumbnails/microsoft.png'
slug: how-to-create-a-fluent-api
categories:
  - Tech
tags:
  - csharp
  - Fluent API
  - Refactor
  - Internship
---

## Fluent API

在进入正式的篇章前，需要先来了解下什么是 Fluent API 以及我们为什么要设计并使用一个 Fluent API。

#### What's a Fluent API

[Fluent API](https://en.wikipedia.org/wiki/Fluent_interface) 是由 [Eric Evans](https://en.wikipedia.org/w/index.php?title=Eric_Evans_(technologist)&action=edit&redlink=1) 和 [Martin Fowler](https://en.wikipedia.org/wiki/Martin_Fowler_(software_engineer)) 在 2005 年提出的，它是一种面向对象的 API，其设计广泛地依赖于 method chaining。它的目标是通过创建**特定于某个领域的语言（[domain-specific language](https://en.wikipedia.org/wiki/Domain-specific_language), DSL）**来提高代码的可读性。

Java 8 中的 [Stream](https://docs.oracle.com/javase/8/docs/api/java/util/stream/Stream.html) 和 C# 中的 [LINQ](https://docs.microsoft.com/en-us/dotnet/standard/using-linq) 都是 Fluent API，另一个比较好的例子是 [Azure Fluent API](https://github.com/Azure/azure-libraries-for-net)，可以参见[最后的一点分析](#azure-fluent-api-insights)。

注意：Fluent API 在调用时可能看起来是 [Builder Pattern](https://refactoringguru.cn/design-patterns/builder) 建造者 / 生成器模式，但是其实二者完全不同。

|        | Fluent API                                                   | Builder Pattern                                              |
| ------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| 着重点 | Fluent API 的重点在于它的本质是一个有限状态机，通过执行特定的步骤来进行状态的转换，并提供了一种  DSL 易于阅读理解的方式。 | Builder Pattern 的重点在于分步骤创建复杂对象，避免重载多参数构造函数，而是使用相同的创建代码（各个 setter）生成不同类型和形式的对象。 |

#### Why Fluent API

1. 代码更可读且更易于理解。
2. 可以 force 程序员在真正运行步骤前去执行一些特定步骤（force the programmer to perform certain steps before they perform others），这在面向对象编程中可能是个问题。一个对象可以有一个使用其中数据的方法，而这个数据可能是在之前的其他方法中 set 的。尽管如此，这并不能 force 程序员去 call the first method，这是假设程序员们已知的。

如果你们团队新来了一个程序员，需要对很久之前的代码进行修改，而你已经忘记了相关的需求，这就是个大问题。但是，如果这个接口是通过良好定义的 Fluent API 来写的，你就可以保证这些「rules of grammar」，并且使得只有在需要的步骤都进行后，才可以对它进行调用。

#### Steps to Create a Fluent API in General

1. **Define the natural language syntax**
2. Create interfaces to enforce grammar
3. Build the class that implements the interfaces

因为 Fluent API 目标是创建于特定于某个领域的语言，所以如何定义自然语言的语法自然成为了重中之重。


## Original Design

回到在微软实习的这个项目中，再我接手前，mentor 炫技想要实现一个 Fluent API，于是做了如下实际。通过提供一个静态 getter 来提供入口，并通过依次添加 Func、TimerService、Logger、BlobStateStore 最终达到可执行态，从而可以调用 Now()。

<div class="filename">FunctionBuilder.cs</div>

```csharp
using System;

namespace xxx
{
    public class FunctionBuilder
    {
        public static ApplyStatement Apply(Func<Worker, TimerService, Worker.State> doWork) =>
            new ApplyStatement(doWork);

        public class ApplyStatement
        {
            private Func<Worker, TimerService, Worker.State> DoWork { get; }

            public WithStatement With(IAzureTimerService azureTimer, ILogger logger) =>
                new WithStatement(this.DoWork, azureTimer, logger);

            public ApplyStatement(Func<Worker, TimerService, Worker.State> doWork)
            {
                this.DoWork = doWork;
            }
        }

        public class WithStatement
        {
            private Func<Worker, TimerService, Worker.State> DoWork { get; }

            private IAzureTimerService AzureTimer { get; }

            private ILogger Logger { get; }

            public InStatement In(BlobStateStore StateStore) => new InStatement(
                this.DoWork,
                this.AzureTimer,
                this.Logger,
                StateStore);

            public WithStatement(
                Func<Worker, TimerService, Worker.State> doWork,
                IAzureTimerService azureTimer,
                ILogger logger)
            {
                this.DoWork = doWork;
                this.AzureTimer = azureTimer;
                this.Logger = logger;
            }
        }

        public class InStatement
        {
            private Func<Worker, TimerService, Worker.State> DoWork { get; }

            private IAzureTimerService AzureTimer { get; }

            private ILogger Logger { get; }

            private BlobStateStore StateStore { get; }

            public InStatement(
                Func<Worker, TimerService, Worker.State> doWork,
                IAzureTimerService azureTimer,
                ILogger logger,
                BlobStateStore StateStore)
            {
                this.DoWork = doWork;
                this.AzureTimer = azureTimer;
                this.Logger = logger;
                this.StateStore = StateStore;
            }

            public void Now()
            {
                this.StateStore.ActAndUpdate(
                    state =>
                    {
                        var timerService = TimerService.With(
                            state.TimerServiceState,
                            this.AzureTimer,
                            this.Logger);

                        var worker = Worker.With(state.WorkerState, this.Logger);

                        return new Host.State(this.DoWork(worker, timerService), timerService.Save());
                    });
            }
        }
    }
}
```

#### How to invoke

```csharp
// useless timerService
Apply((worker, timerService) => worker.Subscribe(...))
  .With(this.azureTimerService, this.listener.Logger)
  .In(this.StateStore)
  .Now();

// useful timerService
Apply((worker, timerService) => worker.Receive(..., timerService))
  .With(this.azureTimerService, this.listener.Logger)
  .In(this.StateStore)
  .Now();
```

## Optimizated Design

原先的设计有如下几个问题。

1. TimerService 其实并不是每个 function 中都需要使用的，所以对于 useless timerService 的场景而言，TimerService 的存在既冗余也违反了最小知识原则。
2. With 语句一次性传入了两个参数，其实并不 fluent style。

#### Unsuccessful Attempts

其实在查阅相关资料前，我和 mentor 也进行了一些思考，并做了一点失败的尝试，也在此记录一下。

1. 基于原先 Apply 语句，可以 Apply 带 TimerService 的，也可以 Apply 不带 TimerService 的，从而进入到不同的 With 语句中，即形成了一棵二叉树，但是这样会造成类爆炸，且十分不利于修改。
2. 因为上述方法有类爆炸问题，所以尝试调换语言顺序，先 With / Using 固定的资源，再 With / Using 可选资源，最后再 Apply / DoWork 来进行调用。但是也比较别扭。

#### Final Design

最后的尝试遵循了参考的两篇博文的思路，亦即上述 [steps](#steps-to-create-a-fluent-api-in-general) ——通过定义自然语言来制定语法规则，从而形成接口，最后实现这些接口。（可以看到，最终的实现是通过接口来避免了之前失败尝试中法一类爆炸的问题。）


<div class="filename">IApply.cs</div>

```csharp
using System;

namespace xxx
{
    public interface IApply
    {
        IWithRepositories Apply(Action<Worker> func);

        IWithRepositories Apply(Action<Worker, TimerService> func);
    }
}
```

<div class="filename">IWithRepositories.cs</div>


```csharp
namespace xxx
{
    public interface IWithRepositories
    {
        IWithLogger WithRepositories(Repositories repositories);
    }
}
```

<div class="filename">IWithLogger.cs</div>

```csharp
namespace xxx
{
    public interface IWithLogger
    {
        INowWorkOrWithOthers WithLogger(ILogger logger);
    }
}
```

<div class="filename">INowWorkOrWithOthers.cs</div>

```csharp
namespace xxx
{
    public interface INowWorkOrWithOthers
    {
        void Now();

        INowWorkOrWithOthers WithTimerService(TimerService timerService);
    }
}
```

<div class="filename">FunctionBuilder.cs</div>

```csharp
using System;

namespace xxx
{
    public sealed class FunctionBuilder : IApply, IWithRepositories, IWithLogger, INowWorkOrWithOthers
    {
        private Action<Worker, TimerService> doWorkWithAzureTimerService;

        private Action<Worker> doWorkWithoutAzureTimerService;

        private Repositories repositories;

        private ILogger logger;

        private TimerService timerService;

        public static IApply WorkerStarter => new FunctionBuilder();

        private FunctionBuilder(){
	      }

        #region Implementation of IApply

        public IWithRepositories Apply(Action<Worker> func)
        {
            this.doWorkWithoutAzureTimerService = func;

            return this;
        }

        public IWithRepositories Apply(Action<Worker, TimerService> func)
        {
            this.doWorkWithAzureTimerService = func;

            return this;
        }

        #endregion

        #region Implementation of IWithRepositories

        public IWithLogger WithRepositories(Repositories repositories)
        {
            this.repositories = repositories;

            return this;
        }

        #endregion

        #region Implementation of IWithLogger

        public INowWorkOrWithOthers WithLogger(ILogger logger)
        {
            this.logger = logger;

            return this;
        }

        #endregion

        #region Implementation of INowWorkOrWithOthers

        public void Now()
        {
            // Initialize one worker for every request which may produce traffic load
            var worker = Worker.With(this.repositories, this.logger);

            if (null == this.timerService)
            {
                this.doWorkWithoutAzureTimerService(worker);
            }
            else
            {
                var timerService = TimerService.With(this.timerService, this.repositories.TimerIssuerRepository, this.logger);
                this.doWorkWithAzureTimerService(worker, timerService);
            }
        }

        public INowWorkOrWithOthers WithTimerService(TimerService timerService)
        {
            this.timerService = timerService;

            return this;
        }

        #endregion
    }
}
```


#### How to invoke

```csharp
// Only worker
WorkerStarter.Apply(worker => worker.Subscribe(...))
  .WithRepositories(this.Repositories)
  .WithLogger(this.listener.Logger)
  .Now();

// worker & timerService
WorkerStarter.Apply((worker, timerService) => worker.Receive(..., timerService))
  .WithRepositories(this.Repositories)
  .WithLogger(this.listener.Logger)
  .WithTimerService(this.timerService)
  .Now();
```

## Azure Fluent API Insights

重构 Fluent API 的正文到这里就差不多结束了，接下来的部分是在实现中参考的 Azure Fluent API。先看看调用的 demo。

```csharp
await Azure
  .Configure()
  .Authenticate(credentials)
  .WithSubscription("subscriptionId")
  .SqlServers
  .Define("sqlServerName")
  .WithRegion(Region.EuropeWest)
  .WithNewResourceGroup()
  .WithAdministratorLogin("sqlAdmin")
  .WithAdministratorPassword("pass")
  .WithNewDatabase("databaseOne")
  .WithNewDatabase("databaseTwo")
  .WithNewFirewallRule("0.0.0.0")
  .WithNewFirewallRule("1.1.1.1")
  .WithNewFirewallRule("2.2.2.2")
  .CreateAsync();
```

<div class="filename"><a href="https://github.com/Azure/azure-libraries-for-net/blob/master/src/ResourceManagement/Azure.Fluent/Azure.cs#L757">Azure.cs</a></div>

```csharp
        public static IConfigurable Configure()
        {
            return new Configurable();
        }

        public interface IConfigurable : IAzureConfigurable<IConfigurable>
        {
            IAuthenticated Authenticate(AzureCredentials azureCredentials);
        }
```

在调用 `Configure()` 后状态转化到 `IConfigurable`，从而可以调用 `Authenticate()` 方法。

<div class="filename"><a href="https://github.com/Azure/azure-libraries-for-net/blob/master/src/ResourceManagement/Sql/Domain/SqlServer/Update/IUpdate.cs#L98">IUpdate.cs</a></div>

```csharp
    public interface IWithDatabase 
    {
        /// <summary>
        /// Remove database from the SQL Server.
        /// </summary>
        /// <param name="databaseName">Name of the database to be removed.</param>
        /// <return>Next stage of the SQL Server update.</return>
        Microsoft.Azure.Management.Sql.Fluent.SqlServer.Update.IUpdate WithoutDatabase(string databaseName);

        /// <summary>
        /// Create new database in the SQL Server.
        /// </summary>
        /// <param name="databaseName">Name of the database to be created.</param>
        /// <return>Next stage of the SQL Server update.</return>
        Microsoft.Azure.Management.Sql.Fluent.SqlServer.Update.IUpdate WithNewDatabase(string databaseName);
    }

    public interface IUpdate  :
        ...,
        Microsoft.Azure.Management.Sql.Fluent.SqlServer.Update.IWithDatabase,
        ...
    {
    }
```

在调用 `WithNewDatabase()` 方法时，其实是在 IUpdate 状态进行自转换。让我们来看看它的实现。

<div class="filename"><a href="https://github.com/Azure/azure-libraries-for-net/blob/master/src/ResourceManagement/Sql/Domain/InterfaceImpl/SqlServerImpl.cs#L62">SqlServerImpl.cs</a></div>

```csharp
    internal partial class SqlServerImpl 
    {
        SqlServer.Update.IUpdate SqlServer.Update.IWithDatabase.WithNewDatabase(string databaseName)
        {
            return this.WithNewDatabase(databaseName);
        }
    }
```

<div class="filename"><a href="https://github.com/Azure/azure-libraries-for-net/blob/master/src/ResourceManagement/Sql/SqlServerImpl.cs#L456">SqlServerImpl.cs</a></div>

```csharp
    internal partial class SqlServerImpl  :
        ...,
        IUpdate
    {
        public SqlServerImpl WithNewDatabase(string databaseName)
        {
            var dbItem = new SqlDatabaseImpl(databaseName, this, new DatabaseInner(), this.Manager);
            dbItem.WithStandardEdition(SqlDatabaseStandardServiceObjective.S0);
            this.sqlDatabasesToCreateOrUpdate.Add(dbItem);
            return this;
        }
    }
```

通过 `return this` 实现了状态转移，其实本质和参考的博文是一致的。

## References

+ [Fluent interface](https://en.wikipedia.org/wiki/Fluent_interface)
+ [Builder Pattern](https://refactoringguru.cn/design-patterns/builder)
+ [How to create a fluent interface in C#](https://scottlilly.com/how-to-create-a-fluent-interface-in-c/)
+ [How to Design and Implement the Fluent Interface Pattern in C#](https://assist-software.net/blog/how-design-and-implement-fluent-interface-pattern-c)
+ [Azure Management Libraries for .NET](https://github.com/Azure/azure-libraries-for-net)