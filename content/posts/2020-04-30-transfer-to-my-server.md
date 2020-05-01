---
date: 2020-04-30
title: '从 Netlify 迁移到自己的服务器'
template: post
thumbnail: '../thumbnails/computer.png'
thumbnailRound: true
thumbnailUrl: https://cdn.charlesfeng.top/thumbnails/http.png
slug: transfer-to-my-server
categories:
  - Tech
tags:
  - Travis
  - DevOps
---

写这篇呢，是因为 Netlify 在国内的访问情况实在太不理想了，春招面试官甚至说打不开，这当然不行啦。所以打算不再部署在 Netlify 上（可是真的还蛮省心的...🤭），还是老老实实在自己的服务器上部署叭。因此，也需要一个完成自动集成部署的工具，我选择回归之前使用的 Travis。而之前部署 hexo 的时候偷懒没写博客，这次回头来看发现又是满头问号，于是痛下决心一定要好好写一下。

## 配置 Travis

Travis 与 GitHub 深度集成，它可以对你 GitHub 中的所有 repo 执行自动化，只要你的 repo 中含有 .travis.yml 文件即可。如果你是第一次编写，可以参考[官方文档](https://docs.travis-ci.com/)。

#### 问题一：`travis` 命令报错

之前安装的 `travis` 命令报错 `bad interpreter: No such file or directory`，在[这里](https://github.com/travis-ci/travis.rb/issues/691#issuecomment-544673561)找到了解决方案，重新进行了安装，然后就可以通过 `travis encrypt-file ~/.ssh/id_rsa --add` 命令在 .tarvis.yml 文件中添加秘钥，从而登录进行部署的远程服务器。

#### 问题二：`rsync` 连接部署服务器

在 `yarn build` 后我们需要将 `/public` 文件夹传到服务器上，我选择了 `rsync` 直接同步两个目录。在我最开始的 yml 文件中，有这样一段。

```yaml
addons:
  ssh_known_hosts: $DEPLOY_HOST
after_success:
- rsync -azv --delete --progress -e 'ssh -o stricthostkeychecking=no' public/ root@$DEPLOY_HOST:/data/charlesfeng/blog/
```

注意这一步的参数 `-e 'ssh -o stricthostkeychecking=no'`，它指明了数据同步的方式——不进行 ssh host key 的验证，否则在执行时仍然会弹出 check 的提示，导致任务无法完成。这里就很迷惑了，我明明在 `addons` 中增加了 `ssh_known_hosts`，为什么还会弹提示？此处困扰了我超久，在 18 年底也没有想通，直到现在再来看，才豁然开朗。

![](https://cdn.charlesfeng.top/images/2020-04-30-rsync-prompt.jpg)

在 18 年底时，我看它既然提醒，那么就直接忽视好了，所以直接通过 `ssh -o stricthostkeychecking=no` 对提示进行了忽略。（学艺不精🥺）但现在来看，这显然不太合理。搜索之后，我本来以为是[此处](https://github.com/travis-ci/travis-ci/issues/9109#issuecomment-359254763)的原因——`ssh_known_hosts` 只是为当前用户添加，但是 `rsync` 是以 root 用户执行的——可是答主还有一句「通过 `sudo` 」，而我没有通过 `sudo` 执行，所以不是这个问题。

后来在日志中看到下图。猜想是因为对配置参数 `ssh_known_hosts` 配置时使用了变量 `$DEPLOY_HOST` ，而这里的变量最终却未能被加入 `ssh_known_hosts` 。换成常量测试通过，确实是这个问题。

![](https://cdn.charlesfeng.top/images/2020-04-30-addons.jpg)

所以，其实在我 18 年的版本中，只需要如下所示这样的代码即可以通过。

```yaml
after_success:
- rsync -azv --delete --progress -e 'ssh -o stricthostkeychecking=no' public/ root@$DEPLOY_HOST:/data/charlesfeng/blog/
```

那么现在自然不再需要这样，直接写上部署服务器域名就好了。（其实部署域名根本不是什么机密，我当时用这个变量纯属好玩，结果还玩错了...）

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
2. 注意配置以实现 `git clone --depth=1`，因为博客 repo 中最初对图片增增删删（最终期望把图片都提出来放到 cdn 上吧），很容易就导致 .git 文件夹太大从而导致克隆太慢，流水线执行时间变长，所以只选择拷贝最近一次。

现在再次部署时，查资料发现资料都说得比较清楚了，推荐的两篇部署文章放在文末了。（可惜我第一次部署时是 18 年 11 月，真是每个坑都踩了个遍...🥺）

#### 一点疑问

不过对 Travis 还有一点疑问...我这一次[构建](https://travis-ci.com/github/CharlesFeng47/charlesfeng.cn/builds/162862298)使用的 `yarn` 版本是 1.22.4，而其他都是 1.15.2。因为在此次构建前我不知道 Travis 已经支持 `yarn`，所以我自己通过 `yum install yarn` 安装了 `yarn`，同时我又缓存了 node_modules。所以猜想这次构建是因为使用了上一次下载的、在 `node` 版本为 12.16.0 支持下最新版的 `yarn`，然后之后的构建使用的是 Travis 提供的 `yarn`。（不过这说明如果一个包在此次构建中使用被使用到，那么就不会被缓存？感觉这个实现比较复杂...这只是一点猜想，没有验证。😶）

## 整体架构

构建完自动部署的流水线，我们就可以通过 Nginx 访问到博客了。因为贫穷，我在服务器上部署了多个内容，下次更新...先不写了。【TODO】

## 不想备案的一点小尝试

#### 方案一：cdn

因为阿里云的 cdn 加速也需要域名备案，所以通过已经备案过的域名 charlesfeng.top 得到另一个 cdn 加速域名 cdn2.charlesfeng.cn，然后为域名 charlesfeng.cn 添加 CNAME 解析到 cdn2.charlesfeng.cn。理想很美好对不对，但是这样 CNAME 解析并不生效，我也没想明白为啥...

![](https://cdn.charlesfeng.top/images/2020-04-30-cdn-cname.jpg)

#### 方案二：更换境外 DNS 解析

##### 1. [DNS.COM](https://www.dns.com/service.html)

等了 20 分钟左右未生效，放弃。

##### 2. [DNSPod](https://www.dnspod.cn/Products/dns)

D 监控显示故障，但是没说原因，放弃。

![](https://cdn.charlesfeng.top/images/2020-04-30-DNSPod-error.jpg)

##### 3. [Cloudflare](https://www.cloudflare.com/dns/)

最开始一直无法导入域名。

![](https://cdn.charlesfeng.top/images/2020-04-30-cloudflare-add-site-error.jpg)



看[文档](https://support.cloudflare.com/hc/zh-cn/articles/205359838-%E6%97%A0%E6%B3%95%E5%B0%86%E6%88%91%E7%9A%84%E5%9F%9F%E5%90%8D%E6%B7%BB%E5%8A%A0%E5%88%B0-Cloudflare-)发现一个[第三方检查工具](https://mxtoolbox.com/ds.aspx)，检索 DNS Record 后发现仍然是 DNSPod 的，而我在 DNSPod 上已经删除了相关域名记录，猜想是这个问题。于是将域名的 DNS 修改为阿里云自己的后，成功在 Cloudflare 上添加域名。但是再添加 DNS 解析后，同样出现了阿里云需要备案的通知😡，所以即使通过国外 DNS 解析，但因为是国内购买的域名，仍不能访问。

#### 方案三：购买境外域名

![](https://cdn.charlesfeng.top/images/2020-04-30-dns-resolver-compare.jpg)

因为尝试对 Cloudflare DNS 解析速度测量一下，和阿里云差不多，所以尝试使用境外购买的域名，看通过「境外域名 + 境外 DNS 解析 + 境内服务器」的组合是否可以访问，以及境内访问的速度如何。

先在 [NameSilo](https://www.namesilo.com/) 购买了一个便宜的域名 charlesfeng.xyz，买完并修改 DNS 记录后测试，境外访问速度还行（但是境外的话 Netlify 本身速度也还不错啊...我瞎折腾啥），然鹅境内速度...

![](https://cdn.charlesfeng.top/images/2020-04-30-namesilo-domain-test.jpg)

我要你有何用！！还好没直接买 .com 域名☹️

这还不是最气人的！！更气的是隔了不到十分钟，发现又出现了阿里云备案的界面。阿里云牛逼。🤯境外域名境外 DNS 指向境内服务器居然也不成。

好了，感受到了被这个页面支配的恐惧...乖乖备案去了。（因为实在不想用境外服务器，之前用谷歌云是，远程操作简直卡爆...😭）

![](https://cdn.charlesfeng.top/images/2020-04-30-beian.jpg)

## 参考

1. [使用 Travis-ci 自动 SSH 部署代码](https://www.zhuwenlong.com/blog/article/5c24b6f2895e3a0fb4072a5c)
2. [Travis CI 自动化部署博客](https://segmentfault.com/a/1190000011218410)
3. [linux rsync 同步命令](https://blog.51cto.com/lookingdream/1826670)
4. [11个国内外免费域名解析服务](https://segmentfault.com/a/1190000000512176)
5. [建站第一步注册域名，选择国外最便宜域名注册商](https://jhrs.com/2019/31589.html)
6. [如何给你的网站套上Cloudflare（以阿里云为例）](https://blog.csdn.net/zhyl8157121/article/details/100551592)