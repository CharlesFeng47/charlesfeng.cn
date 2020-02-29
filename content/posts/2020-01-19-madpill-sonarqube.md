---
date: 2020-01-19
title: 'madpill-sonarqube'
template: post
thumbnail: '../thumbnails/sonarqube.png'
slug: madpill-sonarqube
categories:
  - Tech
tags:
  - SonarQube
---

## SonarQube 的数据库 PostgreSQL

SonarQube 从 7.9 已不支持 mysql，所以采用开源的 PostgreSQL。

PostgreSQL 安装之后，默认生成一个名为 postgres 的数据库和一个名为 postgres 的数据库用户，同时还生成了一个名为 postgres 的 Linux 系统用户（以默认登陆）。

创建系统用户 sonar，专门用于 SonarQube，此外，PostgreSQL 的执行也需要在其数据库用户中（[Role does not exist](https://stackoverflow.com/questions/11919391/postgresql-error-fatal-role-username-does-not-exist)），所以在数据库中也需创建sonar。

#### 使用 PostgreSQL

1. 直接子shell。

```shell
sudo -u sonar psql soanrdb
```

2. 先切换用户，再进入 psql。

```shell
sudo su - sonar
psql sonardb
```

##### 注意

`psql` 命令存在简写形式。如果当前 Linux 系统用户，同时也是 PostgreSQL 用户，则可以省略用户名（-U 参数的部分）。举例来说，我的 Linux 系统用户名为 cuihua，且 PostgreSQL 数据库存在同名用户，则我以 cuihua 身份登录 Linux 系统后，可以直接使用下面的命令登录数据库，且不需要密码。

```shell
psql exampledb
```

此时，如果PostgreSQL内部还存在与当前系统用户同名的数据库，则连数据库名都可以省略。比如，假定存在一个叫做ruanyf的数据库，则直接键入psql就可以登录该数据库。

```shell
psql
```

#### 踩坑

1. SonarQube 启动报错：can not run elasticsearch as root。

> 是因为elasticsearch 不让用root用户直接运行，需要修改 sonarqube 目录的所属用户和所属用户组为 sonar。
>
> 此处需要注意：~~因为想到之后作为系统服务需要用一个统一的别称以避免 SonarQube 升级后还需要更改系统服务文件~~，所以对目录 sonarqube-8.0 建了一个软链接 sonarqube。然后对软链接更改权限时，直接 `chown -R sonar:sonar sonarqube`，发现只更改了软链接的权限，而实际的目录文件权限未更改。
>
> 查阅 chown 文档，`The chown utility changes the user ID and/or the group ID of the speci-fied files. Symbolic links named by arguments are silently left unchanged unless -h is used.` 即只有使用 `-h` 的时候才会修改软链接本身，否则默认修改它们所指向的实际文件，而不是软链接本身。所以 `chown sonar:sonar sonarqube` 或 `chown sonar:sonar sonarqube/` 实际修改的都是 sonarqube-8.0 目录文件的权限，没有异议。
>
> 但是通过试验，`chown -R soanrqube`  只修改软链接，但是 `chown -R soanrqube/` 则会修改实际目录内的权限，但是对实际目录 `chown -R soanrqube-8.0` 和 `chown -R soanrqube-8.0/` 效果相同。应该是因为 `chown -R soanrqube` 递归处理的是软链接文件 inode 号，而`chown -R soanrqube/` 递归处理的软链接文件指向的实际文件的 inode 号吧。

2. SonarQube 密码连接 PostgreSQL。

> SonarQube 连接 postgresql 是通过密码登录，所以修改 postgresql 的配置文件（/var/lib/pgsql/12/data/ph_hba.conf），将 `host all all 127.0.0.1/32 ident` 修改为 ``host all all 127.0.0.1/32 md5`。



## 启动 SonarQube

修改 /opt/sonarqube-6.6/bin/linux-x86-64/sonar.sh 中的 `#RUN_AS_USER=` 为 `RUN_AS_USER=sonar`，可通过以下两种方式启动。

1. 已将 SonarQube 设为系统服务，所以可以通过以下命令启动。

```shell
systemctl start SonarQube
```

2. 进入 SonarQube 主目录启动

```shell
cd  /opt/SonarQube/bin/linux-x86-64/
./sonar.sh start
```



## 参考

+ [End of Life of MySQL Support](https://community.sonarsource.com/t/end-of-life-of-mysql-support/8667)

+ [PostgreSQL 新手入门](https://www.ruanyifeng.com/blog/2013/12/getting_started_with_postgresql.html)

+ [PostgreSQL 中的客户端认证](https://scarletsky.github.io/2017/04/26/client-authentication-in-postgresql/)

+ [Centos7 + SonarQube](https://amos-x.com/index.php/amos/archives/centos7-SonarQube/)