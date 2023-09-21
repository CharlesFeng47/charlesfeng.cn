---
date: 2023-02-28
title: 'HttpHeader 在 key 不存在的时候会返回什么呢？'
template: post
thumbnail: '../thumbnails/http3.png'
slug: what-will-be-returned-if-key-in-http-header-doesnt-exist
categories:
  - Tech
  - Bug
tags:
  - csharp
  - http
  - ChatGPT
---

## 背景

这篇文章主要是为了说明 ChatGPT 使用有风险 😅，还是得实践出真知。👊

我们有一段 code 如下，而我想知道在 `headerKey` 不存在的情况下，会返回 `null` 还是 empty string 呢。

```csharp
public string GetHttpRequestHeader(string headerKey)
{
    return this.HttpContext?.Request.Headers[headerKey];
}
```

在想尝试使用优秀的 ChatGPT 的情况下（才不是懒 🥺），我直接跟 ChatGPT 进行了如下对话。

Q: When using Microsoft.AspNetCore.Http.HttpRequest.Headers, what will return if header key doesn't exist

> ChatGPT: When using the `Microsoft.AspNetCore.Http.HttpRequest.Headers` property to access the headers of an HTTP request in .NET Core, attempting to access a header key that doesn't exist will return an empty string (`""`).
>
> For example, let's say you want to retrieve the value of a header named `X-Custom-Header` from an HTTP request using the `Headers` property. You can use the following code:
>
> ```c
> string customHeaderValue = httpRequest.Headers["X-Custom-Header"];
> ```
>
> If the `X-Custom-Header` key exists in the `Headers` collection, `customHeaderValue` will contain its value. However, if the `X-Custom-Header` key doesn't exist, `customHeaderValue` will be an empty string (`""`). It's important to check for empty strings when working with header values to avoid errors caused by null or undefined values.

Q: will it be null?

> ChatGPT: No, when using the `Microsoft.AspNetCore.Http.HttpRequest.Headers` property to access the headers of an HTTP request in .NET Core, attempting to access a header key that doesn't exist will not return `null`. Instead, it will return an empty string (`""`).
>
> In .NET Core, accessing a non-existent key in a dictionary-like object (such as the `Headers` property of the `HttpRequest` class) will not throw a `KeyNotFoundException` but will instead return the default value for the type of the values in the dictionary. For strings, the default value is an empty string.
>
> Therefore, if you attempt to retrieve the value of a non-existent header key using `Headers[key]`, it will not be `null`, but rather an empty string. You should keep this in mind when checking for the existence of headers or parsing header values.

Q: could you share the authority doc for this one?

> ChatGPT: Sure! Here is the official documentation for the `HttpRequest.Headers` property in .NET Core:
>
> - Microsoft.AspNetCore.Http.HttpRequest.Headers Property
>   - https://docs.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.http.httprequest.headers?view=aspnetcore-5.0
>
> According to this documentation, the `Headers` property returns an instance of the `IHeaderDictionary` interface, which is a read-only dictionary of header names and values. When you access the dictionary using the indexer `Headers[key]`, it returns the value associated with the given key or an empty string (`""`) if the key is not found. This behavior is consistent with the behavior of the `IDictionary<TKey,TValue>` interface in .NET Core.
>
> I hope this helps!

于是我对着如下这段 code 自信满满地去掉了 null check 后的 default value `XXX`。想着 check in 前测一下的，结果还是忘记了。所以最后上线之后被同事过来 challenge。😭

```csharp
string scenario = executionContext.GetHttpRequestHeader(HeaderUtils.Scenario) ?? "XXX";
```

然后我去看了源码，`Headers` 这个 property 是类型 `IHeaderDictionary`，而这个接口的定义写得很明确，`IHeaderDictionary` override 了 `IDictionary` 的 indexer，所以不会抛异常 `KeyNotFoundException`，而是默认返回 `StringValues.Empty`。

``` csharp
namespace Microsoft.AspNetCore.Http
{
    public abstract class HttpRequest
    {
        public abstract IHeaderDictionary Headers { get; }
    }
}

namespace Microsoft.AspNetCore.Http
{
    /// <summary>
    /// Represents HttpRequest and HttpResponse headers
    /// </summary>
    public partial interface IHeaderDictionary : IDictionary<string, StringValues>
    {
        /// <summary>
        /// IHeaderDictionary has a different indexer contract than IDictionary, where it will return StringValues.Empty for missing entries.
        /// </summary>
        /// <param name="key"></param>
        /// <returns>The stored value, or StringValues.Empty if the key is not present.</returns>
        new StringValues this[string key] { get; set; }

        /// <summary>
        
        /// Strongly typed access to the Content-Length header. Implementations must keep this in sync with the string representation.
        /// </summary>
        long? ContentLength { get; set; }
    }
}

namespace System.Collections.Generic
{
    [DefaultMember("Item")]
    public interface IDictionary<TKey, TValue> : ICollection<KeyValuePair<TKey, TValue>>, IEnumerable<KeyValuePair<TKey, TValue>>, IEnumerable
    {
        //
        // Summary:
        //     Gets or sets the element with the specified key.
        //
        // Parameters:
        //   key:
        //     The key of the element to get or set.
        //
        // Returns:
        //     The element with the specified key.
        //
        // Exceptions:
        //   T:System.ArgumentNullException:
        //     key is null.
        //
        //   T:System.Collections.Generic.KeyNotFoundException:
        //     The property is retrieved and key is not found.
        //
        //   T:System.NotSupportedException:
        //     The property is set and the System.Collections.Generic.IDictionary`2 is read-only.
        TValue this[TKey key] { get; set; }
    }
}
```

需要注意的是，`StringValues.Empty` 并不是 `string.Empty`，而是 default null，下面的输出可以帮助大家理解。（感觉 ChatGPT 就是把这个搞混了...？🤭

```csharp
using System;
using Microsoft.Extensions.Primitives;
					
public class Program
{
	public static void Main()
	{
		Console.WriteLine(StringValues.Empty);
		Console.WriteLine((string)null);
		Console.WriteLine(StringValues.Empty == (string)null);
		Console.WriteLine(StringValues.Empty == default(string));
		Console.WriteLine(StringValues.Empty == string.Empty);
	}
}

// Output:
//
//
// True
// True
// False
```

