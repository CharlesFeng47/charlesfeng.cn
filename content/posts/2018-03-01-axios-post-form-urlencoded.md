---
date: 2018-03-01
title: 'axios post application/x-www-form-urlencoded'
template: post
thumbnail: '../thumbnails/axios.png'
slug: axios-post-form-urlencoded
categories:
  - Snippet
tags:
  - Web
  - axios
  - Form
---

默认情况下，axios 会将 JS 对象序列化为 JSON。如果需要使用 ContentType 为 application/x-www-form-urlencoded 来发送数据可以通过以下方式。

#### Browser

1. URLSearchParams。

```js
const params = new URLSearchParams();
params.append('param1', 'value1');
params.append('param2', 'value2');
axios.post('/foo', params);
```

2. 使用 qs 库。

```javascript
const qs = require('qs');
axios.post('/foo', qs.stringify({ 'bar': 123 }));
```

或（ES6 中）

```javascript
import qs from 'qs';
const data = { 'bar': 123 };
const options = {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  data: qs.stringify(data),
  url,
};
axios(options);
```

#### Node.js

```js
const qs = require('qs');
axios.post('http://something.com/', qs.stringify({ foo: 'bar' }));
```

## 来源

[Using application/x-www-form-urlencoded format](https://github.com/mzabriskie/axios/blob/master/README.md#using-applicationx-www-form-urlencoded-format)