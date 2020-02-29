---
date: 2019-07-23
title: 'APFS，macOS 扩展（HFS +）和 exFAT 之间有什么区别？'
template: post
thumbnail: '../thumbnails/fs.png'
thumbnailRound: true
slug: apfs-hfs-exfat-diff
categories:
  - Tech
tags:
  - Storage
  - exFAT
---


基本上有三个主要的选择：

- **APFS**或“Apple File System”是[macOS High Sierra](https://www.howtoip.com/310052/whats-new-in-macos-1013-high-sierra/)的[新功能之一](https://www.howtoip.com/310052/whats-new-in-macos-1013-high-sierra/) 。 它针对固态硬盘（SSD）和其他全闪存存储设备进行了优化，但也可用于机械和混合驱动器。
- **Mac OS Extended** ，也称为**HFS Plus**或**HFS +** ，是1998年至今所有Mac上使用的文件系统。 在macOS High Sierra上，它被用于所有的机械和混合驱动器，并且老版本的macOS在所有的驱动器上默认使用它。
- **ExFAT**是最好的跨平台选项，专为在Windows和MacOS系统上工作而设计。 [将其用于可插入两种计算机的外部驱动器](https://www.howtoip.com/73178/what-file-system-should-i-use-for-my-usb-drive/) 。

选择文件系统基本上是在这三个选项之间进行选择。 其他因素，如加密和区分大小写，不是你应该太挂了。 让我们深入了解一下关于前三个选项的更多细节，然后解释一些子选项。

## APFS：最适合固态和闪存驱动器

APFS或苹果文件系统是2017年macOS High Sierra固态驱动器和闪存的默认文件系统。 它首先于2016年发布，它提供了Mac OS Extended（以前的默认设置）所带来的各种好处。

首先，APFS速度更快：复制和粘贴文件夹基本上是即时的，因为文件系统基本上指向相同的数据两次。 对元数据的改进意味着要快速完成诸如确定文件夹在驱动器上占用多少空间的操作。 还有一些可靠性方面的改进，使损坏的文件更不常见。 这里有很多好处。 我们只是简单介绍一下，所以请查阅我们[关于APFS的所有知识的](https://www.howtoip.com/327328/apfs-explained-what-you-need-to-know-apples-new-file-system/)文章， [以获取有关APFS](https://www.howtoip.com/327328/apfs-explained-what-you-need-to-know-apples-new-file-system/)优势的更多信息。

那么有什么问题呢？ 反向兼容性。 2016年的macOS Sierra是第一个能够读取和写入APFS系统的操作系统，这意味着任何使用旧操作系统的Mac都不能写入APFS格式的驱动器。 如果有一台较老的Mac，则需要一个驱动器来处理，APFS对于这个驱动器来说是不好的选择。 而忘了从Windows读取APFS驱动器：甚至还没有第三方工具。

此时APFS也不兼容Time Machine，因此您必须将备份驱动器格式化为Mac OS Extended。

除此之外，目前没有理由不使用APFS，尤其是在固态硬盘和闪存上。

## Mac OS Extended：适用于机械驱动器，或适用于旧版macOS版本的驱动器

Mac OS Extended是1998年至2017年每个Mac所使用的默认文件系统，当时APFS取而代之。 到目前为止，它仍然是机械和混合硬盘驱动器的默认文件系统，既安装macOS，同时格式化外部驱动器。 这部分是因为APFS的好处在机械驱动上不是很清楚。

如果你有一个机械硬盘，而你打算只用Mac来使用它，那么最好坚持使用Mac OS Extended。 而任何运行El Capitan或更早版本的Mac电脑都需要使用Mac OS Extended进行格式化，因为APFS与这些电脑不兼容。

APFS也不适用于Time Machine，因此您应该使用Mac OS Extended格式化任何要用于备份Mac的驱动器。

## ExFat：适用于Windows计算机的外部驱动器碎片

ExFat基本上只应用于需要与Windows和MacOS计算机一起使用的驱动器。 格式可以追溯到2006年，由微软提供，以提供一些旧版FAT32格式的跨平台兼容性，而不受文件和分区大小的限制。 这不是一个特别优化的文件格式，比起APFS或者Mac OS Extended，文件碎片更容易受到攻击，MacOS使用的元数据和其他特性不存在。

但使用ExFAT格式化驱动器提供了一个巨大的优势：Windows和MacOS计算机都可以读写这种格式。 当然，你可以[在Windows上阅读Mac格式化的驱动器，](https://www.howtoip.com/252111/how-to-read-a-mac-formatted-drive-on-a-windows-pc/)或者[在Mac上](https://www.howtoip.com/252111/how-to-read-a-mac-formatted-drive-on-a-windows-pc/) [阅读Windows格式化的驱动器](https://www.howtoip.com/236055/how-to-write-to-ntfs-drives-on-a-mac/) ，但是这两种解决方案要么花钱要么不稳定。 所以，尽管有缺点，ExFAT是跨平台硬盘的最佳选择。

## 区分大小写：避免，除非你知道为什么你想要它

APFS和Mac OS Extended都提供“区分大小写”选项，但默认情况下，macOS不使用此设置。 除非你真的知道自己在做什么，并有特定的理由要求，否则在格式化驱动器时不应该使用区分大小写。

要清楚的是，你可以在文件名中使用大写字母。 大小写敏感性主要决定文件系统是否将大写字母视为不同。 默认情况下，它没有，这就是为什么你不能在Mac上的同一个文件夹中有一个名为“Fun.txt”和“fun.txt”的文件。文件系统将文件名称视为相同，即使它们看起来不同。

Mac在90年代默认情况下在文件系统中使用区分大小写，但在Mac OS X启动时更改。 基于UNIX的系统通常不区分大小写，而Mac OS X是第一个基于UNIX标准的Mac操作系统。 启用区分大小写功能可能会破坏某些Mac应用程序，但任何拥有可追溯到20世纪90年代的文件系统的用户都可能会丢失文件，而不会启用大小写。

我们的建议是为了避免APFS和Mac OS Extended的区分大小写，除非您有特定的原因需要它。 打开它没有太多的好处，但是各种各样的事情可能会中断，而将文件从一个文件拖到另一个文件可能意味着数据丢失。

## 加密保护您的文件，但可能会影响性能

我们已经告诉过你[如何加密你的macOS硬盘](https://www.howtoip.com/184675/how-to-encrypt-your-macs-system-drive-removable-devices-and-individual-files/) ，但是最快的方法是在第一次格式化硬盘的时候启用加密功能。APFS和Mac OS Extended都提供Encrypted选项，如果担心安全问题，最好在外部驱动器上使用它。

主要缺点是忘记加密密钥意味着无法访问您的文件。 除非您可以记住密钥，否则不要加密驱动器，除非您有安全的地方存储它。

加密的另一个潜在缺点是性能。 加密驱动器上的读写速度会比较慢，但是我们认为这通常是值得的，特别是在便携式Mac电脑上，比如笔记本电脑。

## 其他选项：MS-DOS（FAT）和Windows NT

- **MS-DOS（FAT）**是一种古老的反向兼容的文件格式，是FAT32的前身。 只有在绝对需要与XP SP2之前的Windows版本兼容的情况下才能使用它。 你几乎肯定不会。
- 可能会根据您的设置提供**Windows NT文件系统** 。 这是Windows系统使用的主要驱动器类型，在Windows系统上创建这样的分区可能更好。



## 来源

[APFS，Mac OS扩展（HFS +）和ExFAT之间有什么区别？](http://www.howtoip.com/whats-the-difference-between-apfs-macos-extended-hfs-and-exfat/)