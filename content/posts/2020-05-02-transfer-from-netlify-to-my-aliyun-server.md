---
date: 2020-05-02
title: '从 Netlify 迁移到自己的阿里云服务器'
template: post
thumbnail: '../thumbnails/aliyun.png'
slug: transfer-from-netlify-to-my-aliyun-server
categories:
  - Tech
  - Popular
tags:
  - Travis
  - DevOps
---

写这篇呢，是因为 Netlify 在国内的访问情况实在太不理想了，抖音的面试官甚至说打不开，这当然不行啦。所以打算不再部署在 Netlify 上（可是真的还蛮省心的🤭...放弃心好痛🥺），还是老老实实在自己的服务器上部署叭。而完成自动集成部署的工具呢，我选择回归之前使用的 Travis。

（之前部署 hexo 的时候偷懒没写博客，这次回头来看发现又是满头问号，于是痛下决心一定要好好写一下。）

## 整体架构

#### 之前在 Netlify

（再次痛心疾首，Netlify 的一站式部署实在是方便！只需要指定一下部署指令 `yarn build` 和最后生成的目录 /public 即可，实在是太太太方便了，懒人部署！其他诸如 HTTPS 等好处可以参见我之前的[介绍文章](/intro-to-headless-cms-and-gatsbyjs/#netlify)。）

博客部署在 Netlify 上，因为 Netlify 上的项目都默认拥有一个以 .netlify.app 结尾的域名，而我不想用这个，所以添加了自定义域名 charlesfeng.cn，并使用了 Netlify DNS 进行解析。（Netlify 官方对此 DNS Record 定义的 Type 为 Netlify，不过感觉就是 CNAME 解析叭...）

博客引用的图片通过 cdn 加速，图片存放在自己服务器上，通过 Nginx 进行分发。结构如下图所示。

![](https://images.charlesfeng.cn/2020-05-02-netlify-arch.jpg)

#### 迁移到自己的服务器

因为之前 18 年部署 hexo 博客时，对博客域名和 cdn 加速图片的域名通过 Nginx 进行了分发，所以其实已经形成了一个初步架构，现在只需要在其上进行补充就好了。总体思路仍然是通过 Nginx 对我拥有的东西进行分发处理，所以首先需要明确我现阶段有什么。

1. 自己的博客及对应域名。
2. 自己博客的图片及 cdn 加速域名。
3. 对象的博客及对应域名。
4. 对象博客的图片及 cdn 加速域名。
5. 未来可能会部署的各种项目的服务。（希望不是 flag...🥶）

大概的架构如下图所示。未来如果将项目部署在此服务器上，仍然通过 Nginx 进行转发。此外，这里还学习到对 Nginx 可以监听同一端口，因此可以分到不同的配置文件中，更好地解耦，具体详见[这里](/nginx-conf-multi-server)。

![](https://images.charlesfeng.cn/2020-05-02-own-server-arch.jpg)

对博客而言，Nginx 分发其实就是将请求分发到生成的 /public 目录下，只要路径正确就可以正确访问啦。所以对博客进行更新，其实就是修改服务器上对应的 /public 目录。而自动集成部署博客，就是自动修改啦。

因此，下一步我们来看如何使 Travis 对博客进行自动部署。

## 配置 Travis

Travis 与 GitHub 深度集成，它可以对你 GitHub 中的所有 repo 执行自动化，只要你的 repo 中含有 .travis.yml 文件即可。如果你是第一次编写，可以参考[官方文档](https://docs.travis-ci.com/)。

#### 问题一：`travis` 命令报错

之前安装的 `travis` 命令报错 `bad interpreter: No such file or directory`，在[这里](https://github.com/travis-ci/travis.rb/issues/691#issuecomment-544673561)找到了解决方案，重新进行了安装，然后就可以通过 `travis encrypt-file ~/.ssh/id_rsa --add` 命令在 .tarvis.yml 文件中添加秘钥，从而登录进行部署的远程服务器。

#### 问题二：`rsync` 连接部署服务器

在 `yarn build` 后我们需要将 `/public` 文件夹部署到服务器上，我选择了通过 `rsync` 直接同步两个目录。在我最开始的 yml 文件中，有这样一段。

```yaml
addons:
  ssh_known_hosts: $DEPLOY_HOST
after_success:
- rsync -azv --delete --progress -e 'ssh -o stricthostkeychecking=no' public/ root@$DEPLOY_HOST:/data/charlesfeng/blog/
```

注意这一步的参数 `-e 'ssh -o stricthostkeychecking=no'`，它指明了数据同步的方式——不进行 ssh host key 的验证，否则在执行时仍然会弹出 check 的提示，导致任务无法完成。这里就很迷惑了，我明明在 `addons` 中增加了 `ssh_known_hosts`，为什么还会弹提示？此处困扰了我超久，在 18 年底也没有想通，直到现在再来看，才豁然开朗。

![](https://images.charlesfeng.cn/2020-05-02-rsync-prompt.jpg)

在 18 年底时，我看它既然提醒，那么就直接忽视好了，所以直接通过 `ssh -o stricthostkeychecking=no` 对提示进行了忽略。（学艺不精🥺）但现在来看，这显然不太合理。搜索之后，我本来以为是[此处](https://github.com/travis-ci/travis-ci/issues/9109#issuecomment-359254763)的原因——`ssh_known_hosts` 只是为当前用户添加，但是 `rsync` 是以 root 用户执行的——可是答主还有一句「通过 `sudo` 」，而我没有通过 `sudo` 执行，所以不是这个问题。

后来在日志中看到下图。猜想是因为对配置参数 `ssh_known_hosts` 配置时使用了变量 `$DEPLOY_HOST` ，而这里的变量却不能被解析，所以 `ssh_known_hosts` 中其实并没有添加成功。换成常量测试通过，确实是这个问题。

![](https://images.charlesfeng.cn/2020-05-02-addons.jpg)

所以，其实在我 18 年的版本中，配置的 `addons` 完全没起作用，只需要如下所示这样的代码即可以通过。

```yaml
after_success:
- rsync -azv --delete --progress -e 'ssh -o stricthostkeychecking=no' public/ root@$DEPLOY_HOST:/data/charlesfeng/blog/
```

那么现在理解后，还是选择通过 `addons` 来完成整个步骤，在 `ssh_known_hosts` 中直接写上部署服务器域名 / IP就好了。（其实部署域名根本不是什么机密，我当时用这个变量纯属好玩，结果还玩错了...）

#### 最终配置文件

```yaml
language: node_js
node_js:
- 12.16.0
branches:
  only:
  - master
git:
  depth: 1
addons:
  ssh_known_hosts: 119.23.201.68
cache:
  directories:
  - node_modules

before_install:
# ssh config
- openssl aes-256-cbc -K $encrypted_c4e4594cf959_key -iv $encrypted_c4e4594cf959_iv
  -in id_rsa.enc -out ~/.ssh/deploy_rsa -d
- chmod 600 ~/.ssh/deploy_rsa
- ssh-add ~/.ssh/deploy_rsa
install:
- yarn install
script:
- yarn build
after_success:
# -r, --recursive 对子目录以递归模式处理
# -l, --links 保留软链接
# -p, --perms 保持文件权限
# -t, --times 保持文件时间信息
# -o, --owner 保持文件属主信息
# -g, --group 保持文件属组信息
# -D, --devices 保持设备文件信息
# -a, --archive 归档模式，表示以递归方式传输文件，并保持所有文件属性，等于-rlptgoD
# -v, --verbose 详细模式输出
# -z, --compress 对备份的文件在传输时进行压缩处理。
# --delete 删除那些 DST 中 SRC 没有的文件，可能会导致暂时的服务不可用
# --delete-after 传输结束以后再删除
# --progress 显示备份过程
# -e, --rsh=command 指定使用 rsh、ssh 方式进行数据同步。
- rsync -azv --delete-after -e ssh public/ root@119.23.201.68:/data/charlesfeng/blog/
```

1. 缓存 node_modules 以加快速度。
2. 注意配置以实现 `git clone --depth=1`，因为博客 repo 中最初对图片增增删删（如上述[架构图](#迁移到自己的服务器)所示，最终图片都通过 cdn 加速访问），很容易就导致 .git 文件夹太大从而致使克隆太慢，流水线执行时间变长，所以只选择拷贝最近一次 commit。

现在再次部署时，查资料发现资料都说得比较清楚了，推荐的两篇部署文章放在文末了。（可惜我第一次部署时是 18 年 11 月，真是踩坑无数...🥺）

#### 缓存 node_modules 导致的 `yarn` 版本问题

至此，对 Travis 还有一点疑问...

注意到在我的这一次构建 [#4](https://travis-ci.com/github/CharlesFeng47/charlesfeng.cn/builds/162862298) 中使用的 `yarn` 版本是 1.22.4，而之后都是 1.15.2。这一点就比较有意思， #4 这次构建和之后的构建关于 `yarn` 的部分都是直接使用的 Travis 默认支持的 `yarn`，为什么版本还会不同？

Code never lies。如果不是 Travis 的 bug，那一定与我在这次构建中修改的脚本有关。

在此次构建 #4 前我不知道 Travis 已经默认支持 `yarn`，所以我自己在流水线中通过 `yum install yarn` 安装了 `yarn`。在发现已经默认支持后，我在 #4 相关的这次提交中不再自己安装，而是直接使用。与此同时，我又缓存了 node_modules。而因为在 Travis 的执行中，缓存的 cache 是会在所有[脚本生命周期](https://docs.travis-ci.com/user/job-lifecycle)执行前被获取的（如下图 log 所示，先在 188 行取出了 cache，然后在 208 行才开始执行脚本），所以猜想这次构建 #4 是因为使用了上一次下载的、在 `node` 版本为 12.16.0 支持下最新版的 `yarn`，然后之后的构建使用的是 Travis 提供的 `yarn`。

![](https://images.charlesfeng.cn/2020-05-02-cache.jpg)

事实上，上图的 log 也证明了这一点，在 `script` 生命周期执行完毕后，在 236 行对 cache 进行了缓存，从而修改了 yarn 版本。😶

此外，我看了看 #4 之前的成功构建，即 [#2](https://travis-ci.com/github/CharlesFeng47/charlesfeng.cn/builds/162861013)，发现它使用的版本是 1.22.4，再次说明猜想是正确的。

## 不想备案的一点失败尝试

因为之前部署在 Netlify 上，将我期望的域名 charlesfeng.cn 的 DNS 解析修改为 Netlify 的，然后使用 Netlify DNS CNAME 映射到 Netlify 自己的服务器上。「境内域名 + 境外 DNS + 境外服务器」不需要备案，可以正常通过域名访问。而我迁移到自己的服务器后，因为使用了**境内**服务器，所以如果想通过域名访问，就需要备案。而我不太想加上备案号...所以进行了一些失败的尝试...🥱

#### 方案一：cdn

因为阿里云的 cdn 加速也需要域名备案，所以通过已经备案过的域名 charlesfeng.top 得到另一个 cdn 加速域名 cdn2.charlesfeng.top，然后为域名 charlesfeng.cn 添加 CNAME 解析到 cdn2.charlesfeng.top。理想很美好对不对，但是这样 CNAME 解析并不生效，我也没想明白为啥...

![](https://images.charlesfeng.cn/2020-05-02-cdn-cname.jpg)

#### 方案二：更换境外 DNS 解析

因为不清楚阿里云是在哪一步拦截请求要求备案的，所以猜想是否可以通过境外 DNS 解析来避免。

##### 1. [DNS.COM](https://www.dns.com/service.html)

等了 20 分钟左右未生效，放弃。

##### 2. [DNSPod](https://www.dnspod.cn/Products/dns)

D 监控显示故障，但是没说原因，放弃。

![](https://images.charlesfeng.cn/2020-05-02-dnspod-error.jpg)

##### 3. [Cloudflare](https://www.cloudflare.com/dns/)

最开始一直无法导入域名。

<img src="https://images.charlesfeng.cn/2020-05-02-cloudflare-add-site-error.jpg" height="300px"></img>



看[文档](https://support.cloudflare.com/hc/zh-cn/articles/205359838-%E6%97%A0%E6%B3%95%E5%B0%86%E6%88%91%E7%9A%84%E5%9F%9F%E5%90%8D%E6%B7%BB%E5%8A%A0%E5%88%B0-Cloudflare-)发现一个[第三方检查工具](https://mxtoolbox.com/ds.aspx)，检索 DNS Record 后发现仍然是 DNSPod 的，而我在 DNSPod 上已经删除了相关域名记录，猜想是这个问题。于是将域名的 DNS 修改为阿里云自己的后，成功在 Cloudflare 上添加域名。但是再添加 DNS 解析后，同样出现了阿里云需要备案的通知😡，所以即使通过国外 DNS 解析，仍不能访问，此时我怀疑是因为域名在国内购买。（当然这个猜测现在知道是错误的了...）

#### 方案三：购买境外域名

<img src="https://images.charlesfeng.cn/2020-05-02-dns-resolver-compare.jpg" height="400px"></img>

因为尝试对 Cloudflare DNS 解析 charlesfeng.cn 速度测量一下，和阿里云解析 charlesfeng.top 差不多，所以尝试使用境外购买的域名，看通过「境外域名 + 境外 Cloudflare DNS 解析 + 境内服务器」的组合是否可以访问，以及境内访问的速度如何。

先在 [NameSilo](https://www.namesilo.com/) 购买了一个便宜的域名 charlesfeng.xyz，买完并修改 DNS 记录后测试，境外访问速度还行（但是境外的话 Netlify 本身速度也还不错啊...我瞎折腾啥），然鹅境内速度...

![](https://images.charlesfeng.cn/2020-05-02-namesilo-domain-test.jpg)

我要你有何用！！还好没直接买 .com 域名😨

这还不是最气人的！！更气的是隔了不到十分钟，发现又出现了阿里云备案的界面。阿里云牛逼。🤯境外域名境外 DNS 指向境内服务器居然也不成。

好了，感受到了被这个页面支配的恐惧...

![](https://images.charlesfeng.cn/2020-05-02-beian.jpg)

#### 方法四：境内 DNS 解析到 Netlify

在经过上述三种尝试后，我人已经彻底晕菜了。然后突然福临心至——「为啥需要备案啊」，于是打开[阿里云备案](https://help.aliyun.com/document_detail/147840.html)，想了解下备案的真实原因。（其实很久之前看过，然后忘记了...😂）

>您是否需要备案主要看您的网站等互联网信息服务解析到的服务器是否在中国内地（大陆），如果服务器在中国香港、中国澳门、中国台湾及其他国家和地区，则不需要备案。

根据说明，备案与否只与「**服务器所在地**」有关。所以啊！朋友们！要先看清楚再尝试啊！我就是吃了记忆力不好又想当然的亏啊！不光浪费精力，还浪费钱啊！

至此...我本想再试一下境内 DNS 解析。但是，估计大概率速度不行，所以先直接对 Netlify 提供的域名进行测试。

<img src="https://images.charlesfeng.cn/2020-05-02-ping-netlify.jpg" height="250px"></img>

不管是上图直接 ping 显示结果丢包率 20%，还是下图对网站访问速度的测试，都不算优秀。所以放弃。

![](https://images.charlesfeng.cn/2020-05-02-netlify-test.jpg)

#### 总结

最后总结下我尝试过的方法，从中也可以看出确实只与服务器有关。（当然，因为我没测全，所以肯定不是充分条件。就这么顺嘴一说🥶）

| 域名 | DNS 解析 | 服务器 | 结果 |
| ---- | -------- | ------ | ---- |
| 境内 | 境外     | 境外   | ✅    |
| 境内 | 境外     | 境内   | ❌    |
| 境外 | 境外     | 境内   | ❌    |
| 境内 | 境内     | 境外   | ✅    |

最终还是因为境外 Netlify 速度不🉑️，选择了使用全境内的方式。（其实之前使用谷歌云的服务器时，境内访问速度还行，但是终端远程连接时简直卡爆😭...所以实在不想用境外服务器）

乖乖备案去了～🤐

## 参考

- [使用 Travis-ci 自动 SSH 部署代码](https://www.zhuwenlong.com/blog/article/5c24b6f2895e3a0fb4072a5c)
- [Travis CI 自动化部署博客](https://segmentfault.com/a/1190000011218410)
- [linux rsync 同步命令](https://blog.51cto.com/lookingdream/1826670)
- [11个国内外免费域名解析服务](https://segmentfault.com/a/1190000000512176)
- [建站第一步注册域名，选择国外最便宜域名注册商](https://jhrs.com/2019/31589.html)
- [如何给你的网站套上Cloudflare（以阿里云为例）](https://blog.csdn.net/zhyl8157121/article/details/100551592)