---
date: 2018-01-04
title: 'Filter 中 doFilter 理解'
template: post
thumbnail: '../thumbnails/http.png'
slug: filter-dofilter
categories:
  - Bug
tags:
  - Web
---

在关闭 Cookie 的情况下，系统登出时抛空。

```
04-Jan-2018 15:49:13.902 严重 [http-nio-8080-exec-8] org.apache.catalina.core.StandardWrapperValve.invoke Servlet.service() for servlet [LogOutServlet] in context with path [/GuestOrderApp] threw exception
 java.lang.NullPointerException
	at controller.LogOutServlet.doGet(LogOutServlet.java:27)
	at javax.servlet.http.HttpServlet.service(HttpServlet.java:622)
	at javax.servlet.http.HttpServlet.service(HttpServlet.java:729)
	at org.apache.catalina.core.ApplicationFilterChain.internalDoFilter(ApplicationFilterChain.java:230)
	at org.apache.catalina.core.ApplicationFilterChain.doFilter(ApplicationFilterChain.java:165)
	at org.apache.tomcat.websocket.server.WsFilter.doFilter(WsFilter.java:53)
	at org.apache.catalina.core.ApplicationFilterChain.internalDoFilter(ApplicationFilterChain.java:192)
	at org.apache.catalina.core.ApplicationFilterChain.doFilter(ApplicationFilterChain.java:165)
	at filter.EncodeFilter.doFilter(EncodeFilter.java:26)
	...
```

定位到 EncodeFilter.java。

```Java
package filter;

import org.apache.log4j.Logger;

import javax.servlet.*;
import javax.servlet.annotation.WebFilter;
import java.io.IOException;

/**
 * 解决表单中的中文请求后的乱码问题
 */
@WebFilter("/*")
public class EncodeFilter implements Filter {

    private final static Logger logger = Logger.getLogger(EncodeFilter.class);

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {

    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain filterChain) throws IOException, ServletException {
        request.setCharacterEncoding("utf-8");
        response.setContentType("text/html; charset=utf-8");
        filterChain.doFilter(request, response);
    }

    @Override
    public void destroy() {

    }
}
```

抛错的第 26 行是 `filterChain.doFilter(request, response);` 直观感觉就是 filterChain 抛空。然后想了一会儿不明白为什么他会抛空。。然后觉得其他都正常的，应该是哪个地方 jsessionid 没有加上去。所以再仔细看了一下报错信息，定位到 LogOutServlet.java，第 27 行是 `logger.debug("user " + session.getAttribute("user_id") + "已手动退出");`。session 为空的话，一定是哪个地方 jsessionid 没加啦。然后看 logout button 的链接，确实是没加。然后把链接 encode 一下就好了。

---

需要注意的一点其实不是这个bug，是对 Filter 实现的理解吧。之前一直不知道 `filterChain.doFilter(request, response);` 这句话到底是在干什么，现在知道啦。就是请求来了，进了filter，做到 `filterChain.doFilter(request, response);` 之前的，然后 `filterChain.doFilter(request, response);` 实际是去真正调用servlet实现，然后做完了返回该 Filter 了再做 `filterChain.doFilter(request, response);` 之后的。