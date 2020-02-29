---
date: 2020-02-12
title: 'Enhanced useDataApi Hook'
template: post
thumbnail: '../thumbnails/react.png'
thumbnailRound: true
slug: enhanced-usedataapi-hook
categories:
  - Tech
  - Snippet
tags:
  - React
  - Taro
  - Hook
---

## 起因

小组决定通过 Taro 来开发，但是自己对 React 的印象已经很模糊了。于是需要重新学习 React 🙃。而在学习 Hook 概念并了解相关 demo、example 时看到了这样一篇 [文章](https://www.robinwieruch.de/react-hooks-fetch-data)。让我们先来看看他的最终代码。

```jsx
import React, {
  useState,
  useEffect,
  useReducer,
} from 'react';
import axios from 'axios';

const dataFetchReducer = (state, action) => {
  switch (action.type) {
    case 'FETCH_INIT':
      return { ...state, isLoading: true, isError: false };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        isError: false,
        data: action.payload,
      };
    case 'FETCH_FAILURE':
      return {
        ...state,
        isLoading: false,
        isError: true,
      };
    default:
      throw new Error();
  }
};

const useDataApi = (initialUrl, initialData) => {
  const [url, setUrl] = useState(initialUrl);

  const [state, dispatch] = useReducer(dataFetchReducer, {
    isLoading: false,
    isError: false,
    data: initialData,
  });

  useEffect(() => {
    let didCancel = false;

    const fetchData = async () => {
      dispatch({ type: 'FETCH_INIT' });

      try {
        const result = await axios(url);

        if (!didCancel) {
          dispatch({ type: 'FETCH_SUCCESS', payload: result.data });
        }
      } catch (error) {
        if (!didCancel) {
          dispatch({ type: 'FETCH_FAILURE' });
        }
      }
    };

    fetchData();

    return () => {
      didCancel = true;
    };
  }, [url]);

  return [state, setUrl];
};
```



第一感觉很棒啊，又把状态码和 loading 给做了。然鹅，实际迁移到项目时，却发现不太实用。。所以需要做一些修改。

| 优点                                                    | 不足                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| 1. 封装了状态码和 loading，无需在具体组件中考虑。       | 1. 只支持 GET 请求。                                         |
| 2.通过 `didCancel` 来避免组件 unmount 后仍 set 请求结果 | 2. 请求立马执行，且因为只能在**函数最外层**调用 Hook，不能在循环、条件判断或者子函数中调用。所以无法针对性加载数据。 |



## Enhanced useDataApi Hook

首先我们先直接展示一下修改完的代码。

```jsx
import Taro, {useEffect, useReducer, useState,} from '@tarojs/taro'

import {HEADER_MADPILL_TOKEN_KEY, MADPILL_RESPONSE_CODE} from '../constants'
import {getToken} from '../utils/login'

const dataFetchReducer = (state, action) => {
  switch (action.type) {
    case 'REQUEST_INIT':
      return {...state, isLoading: true, statusCode: undefined};
    case 'REQUEST_SUCCESS':
      console.log('REQUEST_SUCCESS')
      console.log(action.payload)
      return {
        ...state,
        isLoading: false,
        statusCode: MADPILL_RESPONSE_CODE.OK,
        data: action.payload,
      };
    case 'REQUEST_FAILURE':
      console.log('REQUEST_FAILURE')
      console.log(action.errorCode)
      return {
        ...state,
        isLoading: false,
        statusCode: action.errorCode,
      };
    default:
      throw new Error();
  }
};

/**
 *
 * @param option {object}
 * @param option.requestMethod {Taro.request.method}
 * @param option.requestUrl {string}
 * @param [option.initialResultData] {object}
 * @param [option.requestData] {object | array}
 * @param [option.execNow=false] {boolean} set true to send the REQUEST on every change
 * @return {[S, (value: (((prevState: {method: *, data: *, url: string}) => {method: *, data: *, url: string}) | {method: *, data: *, url: string})) => void]}
 */
const useDataApi = ({
                      requestMethod,
                      requestUrl,
                      requestData,
                      initialResultData,
                      execNow = false,
                    }) => {

  const [request, setRequest] = useState({
    method: requestMethod,
    url: requestUrl,
    data: requestData,
    exec: execNow,
  });

  const [resultState, resultDispatch] = useReducer(dataFetchReducer, {
    isLoading: false,
    statusCode: undefined,
    data: initialResultData,
  });

  useEffect(() => {
    let didCancel = false;

    if (request.exec) {
      console.log('now exec')
      resultDispatch({
        type: 'REQUEST_INIT'
      });
      console.log(request.data)

      getToken({
        success: token => {
          let requestHeader = {}
          requestHeader[HEADER_MADPILL_TOKEN_KEY] = token
          console.log(requestHeader)

          Taro.request({
            url: `${HOST}/${request.url}`,
            method: request.method,
            header: requestHeader,
            data: request.data,
            success: result => {
              console.log('success')
              console.log(result)
              const madpillResult = result.data
              if (!didCancel && result.statusCode === 200 && madpillResult.code === MADPILL_RESPONSE_CODE.OK) {
                resultDispatch({
                  type: 'REQUEST_SUCCESS',
                  payload: madpillResult.data
                });
              } else {
                resultDispatch({
                  type: 'REQUEST_FAILURE',
                  errorCode: madpillResult.code ? madpillResult.code : madpillResult.status
                });
              }
            },
            fail: error => {
              console.log('fail')
              console.log(error)
              if (!didCancel) {
                resultDispatch({type: 'REQUEST_FAILURE', errorCode: 400});
              }
            }
          })
        }
      })
    }

    return () => {
      didCancel = true;
    };
  }, [request]);

  return [resultState, setRequest];
};

export default useDataApi
```

对之前的两个问题，其实都是通过在初始化时新增初始参数（`requestMethod` 和 `nowExec`）来解决的。

## 使用 Demo

#### 简单 Demo

在此 demo 中无需只需加载一次数据，所以只需要解构出相关信息。

```jsx
  const [{data, isLoading, statusCode}] = useDataApi({
    requestMethod: ...,
    requestUrl: ...,
    initialResultData: [],
    execNow: true,
  })

  // 数据加载结束
  useEffect(() => {
    ...
  }, [data])

  // 加载中的相关处理
  useEffect(() => {
    if (isLoading) {
      ...
    } else {
      ...
    }
  }, [isLoading])

  // 错误的处理
  useEffect(() => {
    if (statusCode !== MADPILL_RESPONSE_CODE.OK) {
      ...
    }
  }, [statusCode])
```

#### 复杂 Demo

在此我们考虑一个药品信息的加载场景。他可能是新建药品，也可能是查看药品信息。首先定义一个药品类型，以便之后传入 `initialResultData`。

```jsx
  const [medicine, setMedicine] = useState({
    id: undefined,
    name: '',
    producedDate: '',
    expireDate: '',
    group: {
      id: '',
      name: '',
    },
    tags: [],
    description: '',
    reminders: JSON.stringify([]),
    indication: JSON.stringify({
      content: ''
    }),
    contraindication: JSON.stringify({
      content: ''
    }),
  })
```

第二，需要定义新增药品时的请求。

```jsx
	const [{data: warehouseRequestedData, isLoading: warehouseLoading, statusCode: warehouseStatusCode}, warehouseRequest] = useDataApi({
    requestMethod: 'GET',
    requestUrl: `warehouse/${props.routerParams.warehouseId}`,
    initialResultData: {},
  })

  // warehouseRequest 加载结果返回后设置本组件中药品 medicine 的相关信息
  useEffect(() => {
    // console.log('warehouseRequest finish')
    // console.log(warehouseRequestedData)
    setMedicine(preMedicine => {
      return {
        ...preMedicine,
        ...warehouseRequestedData,
      }
    })
  }, [warehouseRequestedData])
```

然后定义查看药品时的请求。

```jsx
  const [{data: medicineRequestedData, isLoading: medicineLoading, statusCode: medicineStatusCode}, medicineRequest] = useDataApi({
    requestMethod: 'GET',
    requestUrl: `drugs/${props.routerParams.medicineId}`,
    initialResultData: medicine,
  })

  // medicineRequest 加载结果返回后设置本组件中药品 medicine 的相关信息
  useEffect(() => {
    // console.log('medicineRequest finish')
    // console.log(medicineRequestedData)
    setMedicine(medicineRequestedData)
  }, [medicineRequestedData])
```

第三，我们需要实现定义在页面初始化的 useEffect() 中的 initData() 方法，他需要根据传入的不同参数区分加载的内容。

```jsx
  const initData = () => {
    if (props.routerParams.action === MADPILL_ADD_CONFIG.ACTION_ADD) {
      // 新增界面
      setDefaultDateWhenAdd()
      if (props.routerParams.addMode === MADPILL_ADD_CONFIG.ADD_MODE_MADPILL) {
        // 从仓库新增
        warehouseRequest(preRequest => {
          return {
            ...preRequest,
            exec: true
          }
        })
      } else if (props.routerParams.addMode === MADPILL_ADD_CONFIG.ADD_MODE_DIRECT) {
        // 直接新增
        setMedicine(preMedicine => {
          return {
            ...preMedicine,
            name: props.routerParams.manualName,
          }
        })
      }
    } else if (props.routerParams.action === MADPILL_ADD_CONFIG.ACTION_REVIEW) {
      // 查看修改删除界面
      medicineRequest(preRequest => {
        return {
          ...preRequest,
          exec: true
        }
      })
    }
  }
```

最后，我们来处理加载中 loading 和错误处理。

```jsx
  // 加载中的相关处理
  useEffect(() => {
    // console.log(`warehouseLoading: ${warehouseLoading}`)
    // console.log(`medicineLoading: ${medicineLoading}`)
    if (warehouseLoading || medicineLoading) {
      Taro.showLoading({
        title: '加载中(/ω＼)',
        mask: true,
      })
    } else {
      Taro.hideLoading()
    }
  }, [warehouseLoading, medicineLoading])

  // 错误的处理
  useEffect(() => {
    // console.log(`warehouseStatusCode: ${warehouseStatusCode}`)
    // console.log(`medicineStatusCode: ${medicineStatusCode}`)
    if (!(warehouseStatusCode === undefined || warehouseStatusCode === MADPILL_RESPONSE_CODE.OK)) {
      Taro.showToast({
        title: '初始化药品失败(ToT)/~~~',
        icon: 'none'
      })
    }

    if (!(medicineStatusCode === undefined || medicineStatusCode === MADPILL_RESPONSE_CODE.OK)) {
      Taro.showToast({
        title: '查找药品失败(ToT)/~~~',
        icon: 'none'
      })
    }
  }, [warehouseStatusCode, medicineStatusCode])
```

## 参考

+ [How to fetch data with React Hooks?](https://www.robinwieruch.de/react-hooks-fetch-data)
+ [useDataApiHook-example](https://github.com/the-road-to-learn-react/react-hooks-introduction/blob/master/src/useDataApiHook-example/index.js)