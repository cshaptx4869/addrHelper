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
                lat: 39.984120, //可选项，初始化纬度
                lng: 116.307484, //可选项，初始化经度
                width: "80vw", //可选项，弹窗的宽度 默认80vw
                height: "80vh", //可选项，弹窗的高度 默认80vh
                success: function (res) { //可选项，确认后回调
                    //addressInfo 选中的地址, geometryPaths 选中的区域坐标
                    console.log(res)
                    if (res.addressInfo === null) {
                        layer.msg("请选择地址后再提交", {icon: 2})
                        return
                    }
                    // if (res.geometryPaths) {
                    //     console.log(this.isPointInPolygon(res.addressInfo, res.geometryPaths) ? '点在所选范围内' : '点在所选范围外')
                    //     console.log(this.isPolygonIntersect(res.geometryPaths, res.geometryPaths) ? '区域之间有重叠' : '区域之间无重叠')
                    // }
                    layer.alert(JSON.stringify(res))
                    // this.close() //关闭坐标拾取器
                }
            })
        })
    </script>
</body>

</html>
```

