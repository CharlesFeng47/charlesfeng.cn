---
date: 2026-04-02
title: '一道用贪心求解最大糖果数量的题'
template: post
thumbnail: '../thumbnails/candy.svg'
slug: max-candies-with-greedy
categories:
  - Tech
tags:
  - Greedy
  - Algorithm
---

## 题目

一家糖果店出售 n 种糖果，每种糖果的供应是无限的。对于第 i 种糖果，其价格规律如下：
* 购买第一颗该糖果的价格为 x_i 元
* 购买第二颗该糖果的价格为 y_i 元
* 购买第三颗该糖果的价格又变回 x_i 元
* 购买第四颗该糖果的价格为 y_i 元
以此类推，价格在 x_i 和 y_i 之间交替变化。

你有 m 元预算，想要购买尽可能多的糖果。你不关心糖果的种类，只希望得到最多的糖果数量。

请计算你最多能购买多少颗糖果。

示例 1:
输入: n = 2, m = 10, prices = [[4,1],[3,3]]
输出: 4
解释: 
第一种糖果购买4颗，花费为 4 + 1 + 4 + 1 = 10 元
总共购买4颗糖果，这是最大值

示例 2:
输入: n = 3, m = 15, prices = [[1,7],[2,3],[3,1]]
输出: 8
解释:
购买1颗第一种糖果（花费1元）
购买1颗第二种糖果（花费2元）
购买6颗第三种糖果（花费3+1+3+1+3+1=12元）
总花费1+2+12=15元，获得8颗糖果

约束条件:
* 1 <= n <= 10^5
* 1 <= m <= 10^18
* prices.length == n
* prices[i].length == 2
* 1 <= prices[i][0], prices[i][1] <= 10^9

## 贪心（错误版）

观察到对每一种糖果都有两种购买方式，买单个或者买两个。注意到如果买两个的话，那一定是最便宜的组合最后颗数最多，所以我们优先买最多的最便宜的双数个，然后再对所有糖果买单数个最便宜的。

```csharp
using System;

public class ShowMeBug
{
    public static void Main()
    {
        int[][] prices = new int[][]
        {
            new int[] { 1, 7 },
            new int[] { 2, 3 },
            new int[] { 3, 1 }
        };
        int remain = 15;
        long res = DoWork(prices, remain);
        Console.WriteLine(res);
    }

    public static long DoWork(int[][] prices, int remain)
    {
        int n = prices.Length;
        int[] two = new int[n];
        int[] one = new int[n];
        for (int i = 0; i < n; i++)
        {
            two[i] = prices[i][0] + prices[i][1];
            one[i] = prices[i][0];
        }

        Array.Sort(two);
        Array.Sort(one);

        long res = 0;

        // buy two
        int twoPrice = two[0];
        long count = remain / twoPrice;
        res += 2 * count;
        remain %= twoPrice;
        Console.WriteLine($"two: res {res}, remain {remain}");

        // buy one
        int index = 0;
        while (remain > 0 && index < n)
        {
            int onePrice = one[index++];
            res += 1;
            remain -= onePrice;
            Console.WriteLine($"one: res {res}, remain {remain}");
        }
        return res;
    }
}
```

其实，也总觉得怪怪的，两个两个买一定比单数个的买优先级更高、是更优解吗？但是面试过程中也没太举出反例，test case 也过了，就先这样了。

## 贪心（正确版）

下来之后跟朋友聊举了反例如下。

假设有十种糖果的 `(x, y)` 价格为 `(1, 10)`，另一种糖果的 `(x, y)` 价格为 `(6, 4)`，预算 `m = 12`。

如果按照上一解法先买 pair，最便宜的 pair 是：`(6,4)` 的 pair，价格 `6+4=10`。我们先花 `10`，得 `2` 颗，预算剩 `2`。再拿 single，从 `(1,10)` 里拿一个 single，花 `1`，再拿另一个 `(1,10)` 里拿一个 single，花 `1`。总共 `2 + 1 + 1 = 4` 颗，总花费 `10 + 1 + 1 = 12`，所以结果为 4。

但是，如果我们先买 10 个 `(1,10)` 的第一颗：花 `10`，得 `10` 颗，剩下 `2` 块，买不了别的，什么也不干，最后结果也是 10 > 之前的解法 4。

所以，两个两个买一定比单数个的买优先级更高、是更优解吗？不对，单个买和两个两个买之间是竞争关系，我们不能固定先买 pair 再买 single。而是应该枚举先买几个 single，再用剩余预算去买最便宜的 pair，因为有时候先拿几个便宜的单颗糖 `x_i` 更划算。

时间复杂度：`O(n log n)`，其中排序 `x_i`：`O(n log n)`，枚举单颗数量：`O(n)`。空间复杂度：`O(n)`。

```csharp
using System;

public class ShowMeBug
{
    public static void Main()
    {
        int[][] prices = new int[][]
        {
            new int[] { 1, 10 },
            new int[] { 1, 10 },
            new int[] { 1, 10 },
            new int[] { 1, 10 },
            new int[] { 1, 10 },
            new int[] { 1, 10 },
            new int[] { 1, 10 },
            new int[] { 1, 10 },
            new int[] { 1, 10 },
            new int[] { 1, 10 },
            new int[] { 6, 4 },
        };
        int remain = 15;
        long res = DoWork(prices, remain);
        Console.WriteLine(res);
    }

    public static long DoWork(int[][] prices, long m)
    {
        int n = prices.Length;
        long[] one = new long[n];
        long bestPair = long.MaxValue;

        for (int i = 0; i < n; i++)
        {
            long x = prices[i][0];
            long y = prices[i][1];

            one[i] = x;
            bestPair = Math.Min(bestPair, x + y);
        }

        Array.Sort(one);

        long[] prefix = new long[n + 1];
        for (int i = 1; i <= n; i++)
        {
            prefix[i] = prefix[i - 1] + one[i - 1];
        }

        long res = 0;
        for (int k = 0; k <= n; k++)
        {
            if (prefix[k] > m) break; // cannot buy first cheapest k candies

            long remain = m - prefix[k];
            long pairs = remain / bestPair;
            long candies = k + 2 * pairs;
            res = Math.Max(res, candies);
        }

        return res;
    }
}
```

#### From ChatGPT

> # 一、哪里是贪心？
>
> 有两个关键贪心决策：
>
> ## 1️⃣ 单颗糖：选最便宜的 x_i
>
> 因为：
>
> - 每种糖最多只能贡献 **一个“奇数位”x_i**
> - 所以你要选哪些种类提供这个“额外一颗”
>
> 👉 显然选最小的 x_i
>
> 这是一个标准贪心：
>
> > “选 k 个最小元素”
>
> ------
>
> ## 2️⃣ 成对糖：只买最便宜的 (x_i + y_i)
>
> 因为：
>
> - 成对糖可以无限买
> - 每一对贡献 2 颗糖
>
> 👉 那就一直买 **单位成本最低的 pair**
>
> 也是贪心：
>
> > “无限资源 → 选最优性价比”
>
> ------
>
> # 二、但为什么还要“枚举 k”？
>
> 这里是这题最关键的点 👇
>
> 你不能直接说：
>
> > “那我就先买所有便宜的 x_i，然后再买 pair”
>
> 因为：
>
> ⚠️ 单颗糖 vs 成对糖 是 **竞争预算的关系**
>
> 比如：
>
> - 有的 x_i 很便宜 → 值得买
> - 有的 x_i 很贵 → 不如直接拿 pair（更划算）
>
> 👉 所以你需要决定：
>
> > 买多少个 single（k）是最优的？
>
> ------
>
> # 三、本质结构
>
> 这题其实是：
>
> ```
> 总糖数 = 单颗数 k + 2 * pair数
> ```
>
> 约束：
>
> ```
> prefix[k] + pairCount * bestPair ≤ m
> ```
>
> 👉 你要在所有 k 中找最优
>
> ------
>
> # 四、所以整体是啥？
>
> 可以这样总结：
>
> 👉 **局部是贪心，全局用枚举补一层**
>
> | 部分          | 策略                 |
> | ------------- | -------------------- |
> | 选哪些 single | 贪心（最小 x_i）     |
> | pair 怎么买   | 贪心（最小 x_i+y_i） |
> | single 买几个 | 枚举                 |