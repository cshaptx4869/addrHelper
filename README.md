# AddrHelper 组件

## 简介

腾讯地图坐标拾取器。基于腾讯地图 API 和 Layui 实现类似于微信小程序 [wx.getLocation(Object object)](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.getLocation.html) 效果。

## 演示

[JQ22](https://www.jq22.com/jquery-info24489)

[GitHub](https://cshaptx4869.github.io/mypage/addrHelper/addrHelper.html)（优先更新!）

![](https://foruda.gitee.com/images/1670470874110770699/77b3a440_5507348.jpeg)

![](https://foruda.gitee.com/images/1670470895786633868/6750c0de_5507348.jpeg)



## 示例

```html
<!doctype html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>腾讯地图坐标拾取器</title>
</head>

<body>
    <div id="map"></div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/layui/2.6.8/layui.js"
        integrity="sha512-lH7rGfsFWwehkeyJYllBq73IsiR7RH2+wuOVjr06q8NKwHp5xVnkdSvUm8RNt31QCROqtPrjAAd1VuNH0ISxqQ=="
        crossorigin="anonymous" referrerpolicy="no-referrer">
    </script>
    <script>
        layui.config({
            base: './'
        }).use(["addrHelper"], function () {
            const addrHelper = layui.addrHelper
            const layer = layui.layer

            // 打开坐标拾取器
            addrHelper.render({
                key: "", //必传，腾讯地图api key 申请方法见：https://lbs.qq.com/webApi/javascriptGL/glGuide/glBasic
                // el: '#map', //可选项，渲染容器，为空则以弹窗形式打开 默认为空
                lat: 30.03033, //可选项，初始化纬度
                lng: 120.5802, //可选项，初始化经度
                zoom: 13, //可选项，地图缩放级别 默认值13
                width: "80vw", //可选项，弹窗的宽度 默认80vw
                height: "80vh", //可选项，弹窗的高度 默认80vh
                toolbar: true, //可选项，显示工具栏 默认true
                created: function () { //可选项，地图被创建后回调
                    // 绘制不可编辑的多边形
                    addrHelper.drawMultiPolygon(
                        {
                            red: {
                                color: "rgba(208, 80, 80, 0.16)",
                                borderColor: "rgba(208, 80, 80, 1)",
                            },
                            blue: {
                                color: "rgba(55, 119, 255, 0.16)",
                                borderColor: "rgba(55, 119, 255, 1)",
                            }
                        },
                        [
                            {
                                "styleId": "red",
                                "paths": [
                                    { lat: 29.99624886560059, lng: 120.6099513512865 },
                                    { lat: 29.99521034937211, lng: 120.6099513512865 },
                                    { lat: 29.99521034937211, lng: 120.6084642659594 },
                                    { lat: 29.99624886560059, lng: 120.6084642659594 }
                                ]
                            }
                        ]
                    )
                    // 绘制可编辑的多边形
                    addrHelper.drawMultiPolygon(
                        {
                            green: {
                                color: "rgba(64, 160, 128, 0.16)",
                                borderColor: "rgba(64, 160, 128, 1)",
                            },
                        },
                        [
                            {
                                "styleId": "green",
                                "paths": [
                                    { lat: 29.98023237402974, lng: 120.6169245254394 },
                                    { lat: 29.979618817541287, lng: 120.6169245254394 },
                                    { lat: 29.979618817541287, lng: 120.61598231201529 },
                                    { lat: 29.98023237402974, lng: 120.61598231201529 }
                                ]
                            }
                        ],
                        true
                    )

                    // 绘制点标记
                    addrHelper.drawMultiMarker([
                        { lat: 29.995756, lng: 120.609328, content: '砥砺文化创业园' },
                        { lat: 29.979950, lng: 120.616484, content: '科创大厦' },
                    ])
                },
                success: function (res) { //可选项，确认后回调
                    //addressInfo 选中的地址, geometryPaths 选中的区域坐标
                    console.log(res)
                    if (res.addressInfo === null) {
                        layer.msg("请选择地址后再提交", { icon: 2 })
                        return
                    }
                    layer.alert(JSON.stringify(res))
                    // if (res.geometryPaths) {
                    //     console.log(addrHelper.isPointInPolygon(res.addressInfo, res.geometryPaths) ? '点在所选范围内' : '点在所选范围外')
                    //     console.log(addrHelper.isPolygonIntersect(res.geometryPaths, res.geometryPaths) ? '区域之间有重叠' : '区域之间无重叠')
                    // }
                    // 关闭坐标拾取器
                    // addrHelper.close()
                }
            })
        })
    </script>
</body>

</html>
```

