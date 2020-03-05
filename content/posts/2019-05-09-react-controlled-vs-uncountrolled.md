---
date: 2019-05-09
title: 'React Controlled vs. Uncountrolled'
template: post
thumbnail: '../thumbnails/react.png'
slug: react-controlled-vs-uncountrolled
categories:
  - Tech
tags:
  - React
---

## 受控组件

受控组件：通过 props 设置表单组件的值。如下通过 this.state.name 设置了 input，同时因为不同于 Vue 中 data 可以直接进行修改，this.state 不可直接修改，故需要提供修改后的响应事件 handleNameChange，将修改的值「推」到表单中。

```jsx
class Form extends Component {
	constructor() {
		super();
		this.state = {
			 name: '',
		};
	}

	handleNameChange = (event) => {
		this.setState({ name: event.target.value });
	};

	render() {
		return (
			 <div>
				<input
					type="text"
					value={this.state.name}
					onChange={this.handleNameChange}
				/>
			</div>
		);
	}
}
```

这意味着数据（state）和界面（inputs）总是异步的。state 将值给 input，并且 input 向 Form 请求修改当前值。同时意味着表单组件能够立刻响应 input 的变化。

## 非控组件

```jsx
class Form extends Component {
	handleSubmitClick = () => {
		const name = this._name.value;
		// do something with `name`
	}

	render() {
		return (
			<div>
				<input type="text" ref={input => this._name = input} />
				<button onClick={this.handleSubmitClick}>Sign up</button>
			</div>
		);
	}
}
```

非控组件通过 ref 获得输入的值，即将需要的时候才将 field 中值「提」出来。

## 总结

根据使用场景选择。如果表单很简单，也没有什么复杂的 UI 反馈，非控组件是完全 ok 的。

| feature                                                      | uncontrolled | controlled |
| ------------------------------------------------------------ | ------------ | ---------- |
| one-time value retrieval (e.g. on submit)                    | ✅            | ✅          |
| [validating on submit](https://goshakkk.name/submit-time-validation-react/) | ✅            | ✅          |
| [instant field validation](https://goshakkk.name/instant-form-fields-validation-react/) | ❌            | ✅          |
| [conditionally disabling submit button](https://goshakkk.name/form-recipe-disable-submit-button-react/) | ❌            | ✅          |
| enforcing input format                                       | ❌            | ✅          |
| several inputs for one piece of data                         | ❌            | ✅          |
| [dynamic inputs](https://goshakkk.name/array-form-inputs/)   | ❌            | ✅          |

## 另外

官方针对表单给出了推荐方案 Formik。

> 如果你想寻找包含验证、追踪访问字段以及处理表单提交的完整解决方案，使用 [Formik](https://jaredpalmer.com/formik) 是不错的选择。然而，它也是建立在受控组件和管理 state 的基础之上——所以不要忽视学习它们。

## 参考

+ [controlled-vs-uncontrolled-inputs-react](https://goshakkk.name/controlled-vs-uncontrolled-inputs-react/)
+ [Formik](https://jaredpalmer.com/formik/docs/tutorial)

