---
date: 2020-02-27
title: 'ModelMapper Converter'
template: post
thumbnail: '../thumbnails/modelmapper.png'
slug: model-mapper-converter
categories:
  - Snippet
tags:
  - ModelMapper
---

先骂一句 ModelMapper 的官方文档！没有层次关系，看着很不清晰！

##创建一个 Converter

#### 1. 扩展抽象类 `AbstractConverter`

```Java
	Converter<Warehouse, WarehouseDTO> converter1 = new AbstractConverter<Warehouse, WarehouseDTO>() {
        @Override
        protected WarehouseDTO convert(Warehouse warehouse) {
            return WarehouseDTO.builder()
                    .name(warehouse.getName())
                    .indication(wrap(warehouse.getIndication()))
                    .contraindication(wrap(warehouse.getContraindication()))
                    .build();
        }
    };
```

#### 2. 实现接口 `Converter` 

```Java
	Converter<Warehouse, WarehouseDTO> converter = context -> WarehouseDTO.builder()
            .name(context.getSource().getName())
            .indication(wrap(context.getSource().getIndication()))
            .contraindication(wrap(context.getSource().getContraindication()))
            .build();
```

## 配置 Converter

1. 为 `ModelMapper` 添加一个 `Converter`，这将为与起讫类型（`Warehouse` 和 `WarehouseDTO`）相关联的 `TypeMap` 设置一个 `Converter`。

```Java
	mapper.addConverter(converter1);
```

2. 直接为 `TypeMap` 设置 `Converter`。

```Java
	mapper.createTypeMap(Warehouse.class, WarehouseDTO.class).setConverter(converter1);
```

3. 为 `TypeMap` 设置在转换属性时的 `Converter`。

```Java
mapper.createTypeMap(Warehouse.class, WarehouseDTO.class).setPropertyConverter(converter1);
```

## 在项目中使用

+ 如果是扩展的 `AbstractConverter`，那么配置 1、2 都是可运行的。
+ 如果是实现接口 `Converter`，却只有配置 2 有效，有点奇怪。。

#### 最终代码

```Java
@Configuration
public class ModelMapperConfig {

    private Converter<Warehouse, WarehouseDTO> warehouseWarehouseDTOConverter = new AbstractConverter<Warehouse, WarehouseDTO>() {
        @Override
        protected WarehouseDTO convert(Warehouse warehouse) {
            return WarehouseDTO.builder()
                    .name(warehouse.getName())
                    .indication(wrap(warehouse.getIndication()))
                    .contraindication(wrap(warehouse.getContraindication()))
                    .build();
        }
    };

    /**
     * 将内容包装为 JSON 字符串
     */
    private String wrap(String toWrap) {
        ContentWrapper wrapper;
        if (null == toWrap) {
            wrapper = new ContentWrapper("");
        } else {
            wrapper = new ContentWrapper(toWrap);
        }
        return JSON.toJSONString(wrapper);
    }

    @Bean
    @Scope("singleton")
    public ModelMapper modelMapper() {
        ModelMapper mapper = new ModelMapper();
        mapper.addConverter(warehouseWarehouseDTOConverter);
        return mapper;
    }
}
```

## 参考

+ [Converters](http://modelmapper.org/user-manual/converters/)
+ [ModelMapper 的高级使用](https://blog.csdn.net/qq_24598601/article/details/90117180)
