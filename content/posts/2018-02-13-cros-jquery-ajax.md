---
date: 2018-02-13
title: '跨域访问 CROS 时使用 jQuery ajax 的坑'
template: post
thumbnail: '../thumbnails/jquery.jpg'
thumbnailRound: true
slug: cros-jquery-ajax
categories:
  - Tech
  - Bug
  - Snippet
tags:
  - cros
  - jQuery
  - Web
---



在做大作业的时候，想尝试前后端解耦的架构，于是前后端系统使用了不同的端口部署。但是这就带来了跨域访问的问题。。在理解了跨域访问的原因后，开始思考解决它。。因为感觉使用JSONP这种方式有点猥琐，而且只支持 GET 访问，所以最后决定使用 CORS 跨域访问。

## 客户端

通过 jQuery 的 ajax 也可以实现跨域访问，代码如下。主要是 `crossDomain: true` 和 `xhrFields`（设置 `withCredentials` 为 `true` 之后才可以发送 Cockie）。

```javascript
$.ajax({
    url: 'http://localhost:3000/TicketsManagementSystem/test',
    crossDomain: true,
    type: 'get',
    xhrFields: {
      withCredentials: true
    },
    // dataType: 'text/plain; charset=utf-8',
    success: function (data, textStatus, jqXHR) {
      alert("succ");
      console.log("getAllResponseHeaders:" + jqXHR.getAllResponseHeaders());
      console.dir(jqXHR);
    },
    error: function () {
      alert("fail");
    }
  });
```

## 服务器

```Java
@WebFilter("/*")
public class CorsFilter implements Filter {

    private static final Logger logger = Logger.getLogger(CorsFilter.class);

    /**
     * 允许远程访问的来源源列表
     */
    private List<String> allowOrigin;

    /**
     * 允许远程访问的方法类型，支持的HTTP请求方法列表
     */
    private String allowMethods;

    /**
     * 确定浏览器是否应该包含与请求相关的任何cookie
     */
    private boolean allowCredentials;

    /**
     * 实际请求期间可以使用的请求标头列表
     */
    private String allowHeaders;

    /**
     * 浏览器允许客户端访问的响应头列表
     */
    private String exposeHeaders;

    @Override
    public void init(FilterConfig filterConfig) {
        logger.debug("Init Cors Filter");

        String allowOriginString = "http://localhost:8080";
        allowOrigin = Arrays.asList(allowOriginString.split(","));
        allowMethods = "GET,POST,PUT,DELETE,OPTIONS";

        allowCredentials = true;
        allowHeaders = "Content-Type,X-Token";
        exposeHeaders = "";
    }

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain filterChain) throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;

        String curOrigin = request.getHeader("Origin");
        logger.debug("currentOrigin : " + curOrigin);

        if (allowOrigin != null && allowOrigin.contains(curOrigin)) {
            response.setHeader("Access-Control-Allow-Origin", curOrigin);
            response.setHeader("Access-Control-Allow-Credentials", String.valueOf(allowCredentials));

            if (allowMethods != null && !allowMethods.isEmpty())
                response.setHeader("Access-Control-Allow-Methods", allowMethods);
            if (allowHeaders != null && !allowHeaders.isEmpty())
                response.setHeader("Access-Control-Allow-Headers", allowHeaders);
            if (exposeHeaders != null && !exposeHeaders.isEmpty())
                response.setHeader("Access-Control-Expose-Headers", exposeHeaders);
        }
        logger.debug(((HttpServletResponse) res).getHeaderNames());
        filterChain.doFilter(req, res);
    }

    @Override
    public void destroy() {

    }
}
```

另外还有一种方法是使用 `WebMvcConfigurer` 接口，但是我试了一下没成功。。就先用 Filter 了。。

然后发现还是不能成功得到数据。。看控制台发现原来是 ajax 得到了数据，状态码也是 200，但是进了 error 的回调函数，而不是 success 的。查资料发现是 ajax 中 dataType 与服务器返回的 dataType 不匹配，注释掉使用 ajax 的 dataType 就好了。。

### 参考

+ [Understanding CORS](https://spring.io/understanding/CORS)
+ [HTTP访问控制（CORS）](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Access_control_CORS)
+ [CORS support in Spring Framework](https://spring.io/blog/2015/06/08/cors-support-in-spring-framework)
+ [[Spring boot 入门之CORS 跨域配置详解](http://www.leftso.com/blog/303.html) ](http://www.leftso.com/blog/303.html)
+ [跨域资源共享 CORS 详解](http://www.ruanyifeng.com/blog/2016/04/cors.html)
+ [说说跨域那些事儿](https://itoss.me/2016/12/31/说说跨域那些事儿/)
+ [使用CORS](http://leungwensen.github.io/blog/2015/cors.html)
+ [【REST】风格框架实战(从MVC到前后端分离)](http://blog.csdn.net/shaobingj126/article/details/49420145)
+ [JavaWeb项目为什么我们要放弃jsp？为什么要前后端解耦？为什么要前后端分离？2.0版，为分布式架构打基础。](http://blog.csdn.net/piantoutongyang/article/details/65446892)

