---
date: 2018-02-20
title: 'Hibernate 映射 Map'
template: post
thumbnail: '../thumbnails/hibernate.png'
slug: hibernate-mapping-map
categories:
  - Snippet
tags:
  - Hibernate
  - Map
---

```Java
/**
 * 此活动中每种座位与其对应价格的映射
 */
@ElementCollection(fetch = FetchType.EAGER)
@MapKeyColumn(name = "seat_id")
@Column(name = "seat_price", length = 150)
@CollectionTable(
		name = "t_package_order",
		joinColumns = {
				@JoinColumn(name = "schedule_id")
		}
)
private Map<SeatInfo, Double> seatPrices;
```

### 参考

- [https://my.oschina.net/u/2398421/blog/491495](https://my.oschina.net/u/2398421/blog/491495)