---
date: 2018-05-22
title: 'Appium 元素定位'
template: post
thumbnail: '../thumbnails/appium.png'
slug: appium-element-locate
categories:
  - Reproduced
  - Snippet
tags:
  - Appium
  - Test
  - Android
---

1. 直接文本定位。

```Java
driver.findElementByAndroidUIAutomator("new UiSelector().text(\"Add note\")");
```

2. 通过 id 定位。

```Java
driver.findElementById("com.smzdm.client.android:id/action_share");
```

3. 通过 xpath 定位。

```Java
driver.findElementByXPath("//android.widget.TextView[contains(@text,'is xpathname')]");
```

4. 通过 content-desc 定位。

```Java
driver.findElementByAndroidUIAutomator("new UiSelector().descriptionContains(\"" + name + "\")");
```

5. 组合定位。

```Java
driver.findElement(By.className(className)).findElements(By.tagName("tagname is me")).get(i);

driver.findElement(By.className(className)).findElements(By.id("id is me")).get(i);

driver.findElement(By.className(className)).findElements(By.name("name is me")).get(i);
```

6. List 遍历判断。

```Java
List<WebElement> textFieldsList = driver
  .findElementsByClassName("android.widget.EditText");
for(int i = 0; i < textFieldsList.size(); i++) {
		if(textFieldsList.get(i).equals("value")){
				textFieldsList.get(i).click();
		}
}
```



## 来源

[元素定位](https://anikikun.gitbooks.io/appium-girls-tutorial/content/find_elements.html)