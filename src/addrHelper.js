layui.define(['jquery', 'layer'], function (exports) {
    "use strict"
    const MOD_NAME = 'addrHelper'
    const $ = layui.jquery
    const layer = layui.layer

    /**
     * 发送请求类
     */
    class Request {
        _options = {
            baseUrl: "",
            url: "",
            type: "GET",
            data: null,
            extraData: null,
            dataType: "json",
            timeout: 0
        }

        constructor(baseUrl, timeout = 10000) {
            this._options.baseUrl = baseUrl
            this._options.timeout = timeout
        }

        jsonp(jsonp, jsonpCallback) {
            this._options.dataType = "jsonp" //发送jsonp请求
            jsonp && (this._options.jsonp = jsonp) //客户端用callback作为参数名将函数传递给服务器端
            jsonpCallback && (this._options.jsonpCallback = jsonpCallback) //不想执行success回调函数，可指定函数名

            return this
        }

        get(url, data = {}) {
            this._options.type = "GET"
            this._options.url = url
            this._options.data = data
            return this.send(this._options)
        }

        post(url, data = {}) {
            this._options.type = "POST"
            this._options.url = url
            this._options.data = data
            return this.send(this._options)
        }

        extraData(data) {
            this._options.extraData = data
            return this
        }

        send(options) {
            if (options.extraData) {
                options.data = {...options.data, ...options.extraData}
            }
            if (options.baseUrl) {
                options.url = options.baseUrl + options.url
            }

            return new Promise(function (resolve, reject) {
                $.ajax({
                    url: options.url,
                    type: options.type,
                    data: options.data,
                    dataType: options.dataType,
                    timeout: options.timeout,
                    success: function (res) {
                        resolve(res)
                    },
                    error: function (err) {
                        reject(err)
                    }
                })
            })
        }
    }

    /**
     * 工具类
     */
    class Utils {
        /**
         * 防抖
         * @param fn
         * @param delay
         * @param immediate
         * @returns {_debounce}
         */
        static debounce(fn, delay, immediate = false) {
            // 1.定义一个定时器, 保存上一次的定时器
            let timer = null
            let isInvoke = false

            // 2.真正执行的函数
            const _debounce = function (...args) {
                // 取消上一次的定时器
                if (timer) clearTimeout(timer)

                // 判断是否需要立即执行
                if (immediate && !isInvoke) {
                    fn.apply(this, args)
                    isInvoke = true
                } else {
                    // 延迟执行
                    timer = setTimeout(() => {
                        // 外部传入的真正要执行的函数
                        fn.apply(this, args)
                        isInvoke = false
                        timer = null
                    }, delay)
                }
            }

            // 封装取消功能
            _debounce.cancel = function () {
                if (timer) clearTimeout(timer)
                timer = null
                isInvoke = false
            }

            return _debounce
        }
    }

    class AddrHelper {
        _options = {
            key: "", //必传，腾讯地图api key 申请方法见：https://lbs.qq.com/webApi/javascriptGL/glGuide/glBasic
            lat: 0, //可选项，初始化纬度
            lng: 0, //可选项，初始化经度
            title: "腾讯地图小助手", //可选项，弹窗标题
            width: "80vw", //可选项，弹窗的宽度
            height: "80vh", //可选项，弹窗的高度
            success: null, //可选项，地址选择成功后回调
            cssDebug: false //可选项，主要为开发时调试样式
        }
        map = null
        makerLayer = null
        geometryEditor = null
        overlayZIndex = 9999
        controlTypeMap = null
        controlPositionMap = null
        editorModeMap = null
        request = null
        layerIndex = 0
        locationInfo = null
        suggestionOptions = null
        selectAddressInfo = null
        selectGeometry = null

        render(options) {
            this._options = {...this._options, ...options}
            if (!this._options.key) {
                throw new Error("参数key必传")
            }
            this.request = new Request("https://apis.map.qq.com").jsonp().extraData({key: this._options.key, output: "jsonp"})
            this.dynamicLoadHtml()
            !this._options.cssDebug && this.dynamicLoadCss()
            this.eventListen()
            //注意：不支持file://方式使用Javascript API GL 详见 https://lbs.qq.com/webApi/javascriptGL/glGuide/glBasic
            this.dynamicLoadJs(`https://map.qq.com/api/gljs?v=1.exp&key=${this._options.key}&libraries=tools`, () => {
                if (this._options.lat && this._options.lng) {
                    this.initMap(Number(this._options.lat), Number(this._options.lng))
                } else {
                    this.initMap()
                }
            })
        }

        close(v) {
            this.layerIndex && layer.close(this.layerIndex)
        }

        dynamicLoadHtml() {
            const _this = this
            this.layerIndex = layer.open({
                type: 1,
                title: this._options.title,
                content: `
                    <div class="addrhelper-getpoint">
                        <!-- 坐标拾取 -->
                        <div class="addrhelper-getpoint-map">
                            <div id="addrhelper-map-container"></div>
                            <div class="addrhelper-getpoint-search">
                                <input type="text" class="addrhelper-search-input" placeholder="输入地址" value="">
                            </div>
                            <div class="addrhelper-getpoint-tips"></div>
                            <div class="addrhelper-search-suggestion">
                                <div class="addrhelper-search-show-btn">
                                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAuCAYAAABXuSs3AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAALqADAAQAAAABAAAALgAAAABSkiQEAAAB4UlEQVRoBe3YP0vDQBQA8Hdp8Q86VHRz8mOI0kVB9AN0dHMStEmWYkEcrJ3sv6EgiB/ASVzU1Yr6OUTwz1yUqM3zbii9BJuKfe8GuYOQd5fw7pdHyB0BsM1WwFbAVsBWwFZAq4C/dzRTKDentCGW0KHM6hWr+fDz7SVoB68y9ihzx3ORwRFRIMK+PBx5pEOEQ7dYL8QnpOqTwYUQKFFPOgwxLHPhyeAKnErBOgjRNoFP6ZMMG99eXz0uZFdbKCAnc4308uHyfHYtuG9d3vTGhotI4Ypy17p8MIEnh5vCs8BN4Nng3HhWOCeeHc6FNwLnwAuV1GTzi/XFDuAFIE7q8zoC3ErJreljSbFxuML8hBcCPmB6NlP1cu9J4O410iW/m3TgGXFCViwduQ+hM5d+DiNjCR3jcH+nthIKOJO7yTHdJTeVW7IF+lhSbBTeDy13lpu1g+3jJGj8mrF3PAldLeWbcdigvhE4NVo9FDucA80O50KzwjnRbHBuNAvcBFrBSTdZ3m59Sf6aOI8vLuo7/ZdPngL2a9Flt99dvxwPv/AEILoicqAVh2zlVD+E5Mc1oz8jF5oULpEIKHy1y5OLg9zhORvUr4deFPLYrZyONxqNUfLENqGtgK2ArYCtwL+qwDfBhRfsRIjmWgAAAABJRU5ErkJggg==" alt="">
                                    <span>展开搜索列表</span>
                                </div>
                                <div class="addrhelper-search-list"></div>
                            </div>
                            <div class="addrhelper-satellite">
                                <span class="icon"></span>
                                <span>卫星</span>
                            </div>
                            <div class="addrhelper-toolbar">
                                <div data-action="marker" class="tool tool-marker tool-active" title="点标记"></div>
                                <div data-action="polygon" class="tool tool-polygon" title="多边形"></div>
                                <div data-action="circle" class="tool tool-circle" title="圆形"></div>
                                <div data-action="rectangle" class="tool tool-rectangle" title="矩形"></div>
                                <div data-action="ellipse" class="tool tool-ellipse" title="椭圆"></div>
                                <div data-action="delete" class="tool tool-delete" title="删除"></div>
                                <div data-action="split" class="tool tool-split" title="拆分"></div>
                                <div data-action="union" class="tool tool-union" title="合并"></div>
                            </div>    
                        </div>
                        <!-- 坐标信息 -->
                        <div class="addrhelper-getpoint-info">
                            <div class="title">点图获取坐标</div>
                            <div class="item">
                                <div class="label">经度</div>
                                <div class="input lng"></div>
                            </div>
                            <div class="item">
                                <div class="label">纬度</div>
                                <div class="input lat"></div>
                            </div>
                            <div class="item">
                                <div class="label">地址</div>
                                <div class="input address"></div>
                            </div>
                            <div class="item">
                                <div class="label">POI ID</div>
                                <div class="input poi"></div>
                            </div>
                            <div class="item tips">
                                <div class="label">绘画工具操作(非绘制模式)：</div>
                                <div class="tip">单选：鼠标左键点击图形</div>
                                <div class="tip">多选：按下ctrl键后点击多个图形</div>
                                <div class="tip">删除：选中图形后按下delete键或点击删除按钮可删除图形</div>
                                <div class="tip">编辑：选中图形后出现编辑点，拖动编辑点可移动顶点位置，双击实心编辑点可删除顶点</div>
                                <div class="tip">拆分：选中单个多边形后可绘制拆分线，拆分线绘制完成后自动进行拆分</div>
                                <div class="tip">合并：选中多个相邻多边形后可进行合并，飞地形式的多边形不支持合并</div>
                                <div class="tip">中断：按下esc键可中断当前操作，点选的图形将取消选中，编辑过程将中断</div>
                            </div>
                        </div>
                    </div>`,
                area: [this._options.width, this._options.height],
                btn: ['确定', '取消'],
                maxmin: true,
                yes: function (index, layero) {
                    if (_this._options.success && typeof _this._options.success === "function") {
                        _this._options.success.call(_this, _this.selectAddressInfo, _this.selectGeometry?.paths ?? null, index, layero)
                    }
                },
                cancel: function () {
                    //右上角关闭回调
                    //return false 开启该代码可禁止点击该按钮关闭
                }
            })
        }

        dynamicLoadCss() {
            if (!$('style#addrHelperCSS').length) {
                $("head").append(`<style id="addrHelperCSS">
                    .addrhelper-text-ellipsis {
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    }
                    .addrhelper-getpoint {
                      height: 100%;
                      width: 100%;
                      display: flex;
                    }
                    .addrhelper-getpoint .addrhelper-cursor-point {
                      cursor: url("data:image/x-icon;base64,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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA////AP///wK+vr6EMzMz/b6+voT///8C////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD///8A////Ar6+voQzMzP9vr6+hP///wL///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP///wD///8Cvr6+hDMzM/2+vr6E////Av///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA////AP///wLc3NyLj4+P/9zc3Iv///8C////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/4P+AP+D/gD/g/4A/4P+AP+D/gD/Af4A/gD+APwAfgD4AD4ACAAgAAAAAAAAAAAAAAAAAAgAIAD4AD4A/AB+APwAfgD/Af4A/4P+AP+D/gD/g/4A/4P+AP+D/gA="), auto;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map {
                      width: 75%;
                      position: relative;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map #addrhelper-map-container {
                      height: 100%;
                      width: 100%;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-getpoint-search {
                      display: flex;
                      position: absolute;
                      top: 20px;
                      left: 20px;
                      width: 35%;
                      height: 36px;
                      border: 1px solid #F3F3F3;
                      box-sizing: border-box;
                      border-radius: 5px;
                      line-height: 36px;
                      background-color: #FFFFFF;
                      z-index: 9999;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-getpoint-search:hover {
                      border: 1px solid #CCCCCC;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-getpoint-search input {
                      width: 100%;
                      flex: 1;
                      padding-left: 8px;
                      border: none;
                      outline: none;
                      border-radius: 5px;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion {
                      width: 35%;
                      max-height: 50%;
                      overflow-y: auto;
                      box-sizing: border-box;
                      position: absolute;
                      top: 56px;
                      left: 20px;
                      background-color: #FFFFFF;
                      z-index: 9999;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion::-webkit-scrollbar {
                      width: 6px;
                      height: 6px;
                      background-color: #F5F5F5;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion::-webkit-scrollbar-thumb {
                      background-color: #DDDEE0;
                      background-clip: padding-box;
                      border-radius: 3px;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-show-btn {
                      height: 0;
                      overflow: hidden;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      cursor: pointer;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-show-btn img {
                      height: 23px;
                      width: 23px;
                      transform: rotate(90deg);
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-show-btn span {
                      opacity: 0.8;
                      font-size: 14px;
                      color: #1B202C;
                      font-weight: 400;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-list .addrhelper-search-address {
                      box-sizing: border-box;
                      padding: 0 15px;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-list .addrhelper-search-address:hover {
                      background-color: #F5F9FF;
                      cursor: pointer;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-list .addrhelper-search-address .border {
                      display: flex;
                      align-items: center;
                      box-sizing: border-box;
                      padding: 10px 0;
                      border-bottom: 1px solid rgba(27, 32, 44, 0.05);
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-list .addrhelper-search-address .border .index {
                      height: 24px;
                      width: 24px;
                      background: rgba(0, 98, 255, 0.08);
                      margin-right: 8px;
                      font-size: 12px;
                      color: #0062FF;
                      text-align: center;
                      line-height: 24px;
                      font-weight: 400;
                      border-radius: 50%;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-list .addrhelper-search-address .border .info {
                      width: calc(100% - 32px);
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-list .addrhelper-search-address .border .info .title {
                      font-size: 14px;
                      color: #1b202c;
                      line-height: 22px;
                      font-weight: 600;
                      margin-bottom: 4px;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-list .addrhelper-search-address .border .info .address {
                      font-size: 12px;
                      color: #535B6E;
                      line-height: 18px;
                      font-weight: 400;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-list .addrhelper-search-address-active {
                      background-color: #EBF3FF;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-list .addrhelper-search-address-active .border .index {
                      background-color: #0062FF;
                      color: #FFFFFF;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-list .addrhelper-search-address-active .border .info .title,
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-search-suggestion .addrhelper-search-list .addrhelper-search-address-active .border .info .address {
                      color: #0062FF;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-satellite {
                      position: absolute;
                      top: 20px;
                      right: 20px;
                      z-index: 9999;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      width: 85px;
                      height: 36px;
                      font-size: 14px;
                      color: #1F2226;
                      background: #FFFFFF;
                      box-sizing: border-box;
                      border: 1px solid rgba(31, 34, 38, 0.1);
                      box-shadow: 0 4px 10px 0 #1F222612;
                      border-radius: 4px;
                      cursor: pointer;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-satellite:hover {
                      border-color: #A5A7A8;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-satellite .icon {
                      background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAMKADAAQAAAABAAAAMAAAAADbN2wMAAAFKElEQVRoBe1YfWhbVRS/574knXNSHThkYzoZWBXxY1XnyrR+gLWiUMFW0fn5j5vVNkk3ik27vdmmtLQmaUpxAwc6nOJqmf6jU1hXmdMhWKuoiMwOhsN1CGsUV5f0vevvJrtp0qZJXhL0D9+F5Nx7z8c953fPPe++x5jdbARsBGwEbARsBGwEbAT+vwhQIaF7fQNVphCvQ/k70nh/oLPp21x2dH1oWSQa7SJG44Fu995c8vnyeb6CqXKCibcZEzeCbjINY8LtC33k6QhXp8rM709HY28JxppNxt5s6RionM8vdGw5AK8vfIcQ4uq0BYWoFYYx5m4LHWtpD9aBn7azLXr4esg/onRMzXlW9YullgMQwnx0blE6ScQAqmpivWGyA0ixH71twed1fb9LcoyYuQ07poL6MKi/OKk0iqXWAyB2g1qUc9bInK4Kxmg3Ef2t5pFa1yKqPZHYqUlve/BVJtiTiseJ96p+KajlAEiItWphcmjHg3rj8VC3e/NFS9kaBNEDmCOKLwRbZZqsA+g75RwO8BcBf9MxxS8FtRwAvFiuFnaWaVOq3+1zTwX97lfKXdqVjHgrUus3xZujotLjCw1tbR9MP0NzApZ7Ki/zVsRBPQFE10iFMhe/qldvPplJORwOl02eFk9Btg+/S9NlyMDCww4mevu6PRPpPGsjywEAwXFUmVvkMg6NVfV3er7MtmR9vdBWV4Q3m6Z4BoHctkCW6BMHiZ7+Ls/YAl4eE448ZOaLjGMiHoBpsLvRzxrA8DAZkBmSP3f74L0kZltxNu7HONGEqJkVrMbjC37FifVe4nB/oOuUUtmUYGZq/QxwGlWmUBjrVD8fGup6eTTo99RwTVvHiN7DsZbBxRuCuh0leGQ6hhLcEY4DpHjZqOUAuLbkU+TdjDQqF/VuH7gn2wKZeLh6fBPyux93cl6ByrUrtQTDaIVpmvsy6WWasxzAa/oLvwO9PcqYaYiAPLBqbIX2dTX9gsq1JVGC2RmlS0z8rPq5qOUApEGXk/rULgCxm09MmaFcC2Xjz5xjTdjNFVIG5TfqII4nd35Ny08sXero2MFIVXXtGSz68AXOrRvuql3xwH0fHxwb24k7W35N3pn+mL2sHXRHUoPznkBX8/vJcY6O5TKaas/TFtqHa8MTag7GPmOaszHY+dIPam4x6vUNrRYstgvOP6hkcBYObLhpZX1DQ0PycCveYrSoAHT9sCMSm3gDO4Ean2hIAVRFGkFJfIeXLz/Uv+3pvxRP13cv/TM6c6dJ7DHobEIZiF8xJB/XjEPlrvKHdP255J1K6WWjRQUgDcs0wO1zryDshGALzhRQPY2cOgteOcQvT3Va6idus9QD5LdbQV7qyrZgwcR0/v9wEIDTkUzOSysI8Ar8XYfeygzOj3LGq1GJfIU4L+0X8iSWeos24mw/rv4/IUXqgO41CGDJnDCCZWIW8+cxN4KH2rNzvMJ6JQ8AOzENRGVV2SHTq3Xn4CqD0TIgPW3ORuvxtA0jOOQ+P1eYy+lapQ8gxX48vRj7VU15fAMxduEFDplX9PmTdos+A8q5/4r+qwEAdZyBREOvJDtQkJGtHaH1+C60LumMSRuTDzRin8tngOKlU9qI9wL14DuCd+p3E3wyuYOO9uvN36fL5x5ZDkBedU3D/BrVxLJudnfoPFHZ2qB/y6nsculc6ylE8vWw1M7HnXKR07g43b3co4JQlN98BFElqmRB+vPd4gzfLogOB/zukfk8e2wjYCNgI2AjYCOQDYF/AOd7vxZ1h9hGAAAAAElFTkSuQmCC);
                      background-size: 24px 24px;
                      background-repeat: no-repeat;
                      display: inline-block;
                      width: 24px;
                      height: 24px;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-satellite .icon-active {
                      background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAMKADAAQAAAABAAAAMAAAAADbN2wMAAAEVElEQVRoBe1Ya4hVVRT+1twZjclIpHwUEw2GOiHkAx+YkRFkiT9MzKSCYu6Mj/H5R8QHNoQ/ekgEIs5MdxIElYpB+mUE+SCLIkoKi2hofphiRqAoPkZn7vLbZzp79p079567z732p7Nhz1lnPfZa31r7rL3nAslIMpBkIMlAkoEkA0kGkgz8fzMgsaA36zxksY+2P6Mau9EuP0Wu06Kj0ItdEPyIjByI1C9RIR6AtPZAUe/4OIoU3sGHctLh5ZJp7aLNUjIVVZhFED/kKsR7q/I2a9K5Q4I3S7yAfpxAo36LtC6Bam5iVunjtHnR+qrBJUuXSfgDyGKZ9Sk4yy2Rte/AHAZ6BGn8SiCNaNURgawPm/kcACX4DPukx7Epi/QHAEy1HquwlvRkhtbO503LB6YQSCfh9aBJ3yL/VSsTbrUKjtxSl7JwWrsZ3GOBajUa0CG/BXSTjmMtNhHMGsrvL7DUN/hIniwgi8WOU4Ex1lMKFy2dkYsMbitq8QhBbOG8YGUhIZjJrbWXVakPWeU+/QEorlin/bjP0iGxR66gU94lkHqCaCb7cihiZUZytrBS3QRyGM06zcpiEv4AxOkgfXi4oN890ksgGVzFA2yb6zi/d3RTBLKCnes0O9fnrMgCR+ZF+gNQHkThECwIyYLPT6WfPX8v52yCeJZV+WKI7kJW5Dgr8h2BLGXn8orJSzlwLDjmBLDEoaPJjBxjVRYSxAzOj2nQb40UswmkC38GLXi65UcQ/gBSQQZvBOsap436TISPfHGnnCaQFbyGTGZV2qgw2IKVPOBgvtHwHH8AHfIPs9dplxO8j/U60r77EB3yB7fWGoJ4lGZ/O6a/O3RR0h+AWS6F9/g3rMI0Uh8U9RIt3ECVsf+q3WJlzMld0ogHoEPOcvWN1kMWq4P+7vkBBnemtO7g3t9m1xImp1267XsE4X8Suwum9SDb4SsO6ySrs5a30l8c3vBki9bxet1G+0WOwhE8j5ewnJ2rxFEegFatZtfIMIjXrT9BH2lzdT6EMfgSu+Wala3UWvKfYu95md/Ra6RrrEyoW4fFaJXBD9oKCxPlATDrmqtzEw4wGFOJ4bbkXwzWXJ/N/ejBnKDJoCzL+Taew06fzBtTM4ZzOCAp9a+IMoCviqw1nkE3cD6UFzx4pqTwNDvR9jjBmxCrS43TQ+8TAjI3VP5jg0l83uPYKuk+ynuDQ2u/vOHIYpHlVyDf7WUeUm9yPsHTopY1rmOaGghjArNtOlcNgY0i/3q+qT/nblRgMAqzvYBzltGoty0trEMFxt2oQAXCKn2J/xaAcPOEw3z6FRjxFlmpc/gRzrD+FfMZWnigneL+PmRlLuHqmc4lOByIlasBX/O7OeOql0L7A0jrdAZrftPxty0WkelMNZiINjlfTG2ozH8LKUZXPHgTlWIET+h7hwYY9R4vi+Y3H/Af9EpVYWALHeePAl1RASfyJANJBpIMJBlIMuBm4A79OxMc7pa6iAAAAABJRU5ErkJggg==);
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-satellite-active {
                      background-color: #EBF3FF;
                      color: #0062FF;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-toolbar {
                      position: absolute;
                      right: 20px;
                      bottom: 20px;
                      z-index: 9999;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-toolbar .tool {
                      width: 30px;
                      height: 30px;
                      float: left;
                      margin: 1px;
                      padding: 4px;
                      border-radius: 3px;
                      background-size: 30px 30px;
                      background-position: 4px 4px;
                      background-repeat: no-repeat;
                      box-shadow: 0 1px 2px 0 #e4e7ef;
                      background-color: #ffffff;
                      border: 1px solid #ffffff;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-toolbar .tool:hover {
                      border-color: #789cff;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-toolbar .tool-active {
                      border-color: #d5dff2;
                      background-color: #d5dff2;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-toolbar .tool-marker {
                      background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAe1BMVEUAAAAuUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf+dtgltAAAAKHRSTlMAgPkR2afg6YP69tGRjIfywa2ilXVuHwPtxbHKtmcwFQebflZN4kJBQ7UEGAAAAVxJREFUOMvNlFlygzAQBSUh9s0sDuB9S9L3P2HKxiSxJONf998UXQMzPEm8D7vTEEI4nHaz2iXll/TyVPMqKIc6lzKvhxIqz+19aNQmkneijUJ/OPtpwkb+IwvRrp4rwkI+UISsbO9MkkmDLOFsep1mIy026M4Qvynvc/iBUoF/n6jnyxAzhvHZghuLqcoMcU099kMtPW+pGHvWrA2xZxwlYHktW4JbmdMbYsz4iQrvtlSUvAGGmFC4xILEEAMa16szAkOsqFzDVNa/aUld60lpzejEcT4tPI6nhecxVoB8UmmR4ttpTKhMryJxJHJLfHz0jjFb4aAhaYyQNcJFt6LM/7y8ZNUJJ4fFGPIp3ovD02OY8hndkxiQeuIpe816FNfo/exFoajHHKqdmKWlj6SMQloxT6evcfCtQ+Xau5ZSW5u22aOu8d2Ll4TUR0rxmgIgF685FH3ZHMQb8QPO1R7eUFa7JwAAAABJRU5ErkJggg==");
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-toolbar .tool-polygon {
                      background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAgVBMVEUAAAAuUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf+fy4kNAAAAKnRSTlMAgO6J4ALbk47Ur/vkxfbnzsGclzupYh0RooY2CPK8ubZUTkNALQzidBcaeiw5AAABGElEQVQ4y9WUV27DMBBEtRJNiurdklzjxClz/wMmcBTCFIvz6/c9wMMMsBs8J3uRjP/JXSXAuoexzWcBxpHSxp/bHoGKqALqrS/3EiLs6YepRHhxxt4bQEZ0Y5aA2NtzO470TIoTIK+2FpSCC7qjZSgGs0V+a6FTAf1q0uGAciKDpNAnHXtAzmQh1iZ9zVAkZEWflIPH5GQKIZdgjJw81GiXYIeMPDC8/U1YoiUnLUrVRqD2mUWgaoM9Mi/uEMJrVjQ4koP817xwAXObu/t7OsAxeYNMO4oeZ5c51m8AnKxk6PQrKBDZzR+rc0yQeM2KAdxu3q2CY4rZZmbGIzghcZgNtxRxpDDMiq8UJsqs9eachYolGAXPxDfyLBxBd4pYrQAAAABJRU5ErkJggg==");
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-toolbar .tool-circle {
                      background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAASFBMVEUuUf8AAAAuUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf9KFc4ZAAAAF3RSTlOZAKC0883C9eze21kWYK5+PSKtez4hYkfRD1wAAADlSURBVDjLtdRZjsIwEEXRojxkHoG++99pdySHDhBbxQf3+0hREvvJxdjXYT9oqKuqDjr0BTg7Drk5A5eNNXFUER1js9HlDHYeH1QeafD47h1O0O5spy1Mr/AKUd6KcH2GHTg5yUF3hHdPlNMi/n6AjlYytbh/OOM1B9UzP6AjSLbAuMMeNA8V+gQHGinUMCSoxBKMaIKBsQRHQoI1WoJKnWCFFKMyQ/OjbS+zEsyfx/zBzb/QeCic+Zh9fnAvS+kqLJ9frq0pd10n6wBYJ6UwUqv+oTUzUqnb8+zdTEP6039/w439Apc7EgHZaHTcAAAAAElFTkSuQmCC");
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-toolbar .tool-rectangle {
                      background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoAgMAAADxkFD+AAAACVBMVEUAAAAuUf8uUf/ZwoV+AAAAAnRSTlMAgJsrThgAAAAeSURBVBjTYyAXaK0CgxWoTM1QMMgYZWIwcYQZmQAAl/5Vvwi1RhIAAAAASUVORK5CYII=");
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-toolbar .tool-ellipse {
                      background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAY1BMVEUAAAAuUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf8uUf+HzbSYAAAAIHRSTlMAgOK48Z+OseXdkotyEQoDycZPqvbe0qiFWDsIqWBOYlHlwV8AAADYSURBVDjL7ZTZDoIwEEU7XSlgZREVcbn//5UG0BCipfOu57E5SdPp3Cv+7C+lqaUGtKxNedlHrOaksUKfmk93KCUAWTtjC6LCGldPB+Ww9u4SkMrSCqvG07tYCAbwLX3h6gET3t6uAhRFUEC1e3lHZDlFyTMcZ9NBFrRBIeFG7wZtaROrcRMiZHCUwCEbRA9PSTr0ooVKiwqt8MjTYo5OHHBOi2cc+GLHvJr9GN54PHruwAPzCx/MpVD8NeMv7hKFayIKM008XA0zroFZAPFKqeZKqaZK+XmeX80YsKoPvWkAAAAASUVORK5CYII=");
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-toolbar .tool-delete {
                      background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoAgMAAADxkFD+AAAACVBMVEVHcEwuUf94nP9ar54sAAAAAXRSTlMAQObYZgAAADFJREFUeAFjIBGwhoYGYGGuWoXBFA0FgxBUJkPUKiBYykARM2rpQDMp9wUkSJCZJAEAnF5hx8tYRE0AAAAASUVORK5CYII=");
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-toolbar .tool-split {
                      background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAACVBMVEVHcEwuUf94nP9ar54sAAAAAXRSTlMAQObYZgAAADdJREFUeNrt1EEKAAAERFHc/9AuMJImsZi/fgsp7EtexMAACTawWTMD0TSCryBsAHVSDNz6ivclJUcFWdE3iI0AAAAASUVORK5CYII=");
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-toolbar .tool-union {
                      background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoAgMAAADxkFD+AAAACVBMVEVHcEwuUf94nP9ar54sAAAAAXRSTlMAQObYZgAAADVJREFUeAFjIAaIhoKAAxpTbBUQrKQykzE0NAwLMwtI05k5NTQUC3MK0K1UZoJDNASFSRgAAEQyidHYx61BAAAAAElFTkSuQmCC");
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-map .addrhelper-getpoint-tips {
                      position: absolute;
                      z-index: 9999;
                      background-color: #484847;
                      color: #FFFFFF;
                      padding: 5px;
                      border-radius: 3px;
                      font-size: 12px;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-info {
                      width: 25%;
                      background-color: #FFFFFF;
                      padding: 25px 20px;
                      box-sizing: border-box;
                      word-break: break-all;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-info .title {
                      font-size: 16px;
                      color: #1b202c;
                      letter-spacing: 0;
                      line-height: 24px;
                      font-weight: 600;
                      min-height: 24px;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-info .item {
                      margin-top: 20px;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-info .item .label {
                      margin-bottom: 4px;
                      font-size: 14px;
                      color: #1b202c;
                      letter-spacing: 0;
                      line-height: 22px;
                      font-weight: 600;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-info .item .input {
                      padding: 0 40px 0 8px;
                      min-height: 34px;
                      line-height: 34px;
                      background: rgba(27, 32, 44, 0.03);
                      border: 1px solid #ced2d9;
                      border-radius: 4px;
                      font-size: 14px;
                      color: #1b202c;
                      font-weight: 400;
                    }
                    .addrhelper-getpoint .addrhelper-getpoint-info .tips .tip {
                      margin-bottom: 5px;
                      color: #999999;
                      font-size: 14px;
                    }
                </style>`)
            }
        }

        /**
         * 动态加载 js
         * @param url
         * @param callback
         */
        dynamicLoadJs(url, callback) {
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = url;
            if (typeof (callback) == 'function') {
                script.onload = script.onreadystatechange = function () {
                    if (!this.readyState || this.readyState === "loaded" || this.readyState === "complete") {
                        callback();
                        script.onload = script.onreadystatechange = null;
                    }
                };
            }
            document.body.appendChild(script);
        }

        /**
         * 初始化地图
         * @param lat
         * @param lng
         * @returns {Promise<void>}
         */
        async initMap(lat, lng) {
            if (!lat || !lng) {
                let ipLocationReturn = await this.ipLocation()
                if (ipLocationReturn.status === 0) {
                    lat = ipLocationReturn.result.location.lat
                    lng = ipLocationReturn.result.location.lng
                    this.locationInfo = ipLocationReturn.result
                }
            }

            //https://lbs.qq.com/webApi/javascriptGL/glDoc/docIndexMap
            this.map = new TMap.Map("addrhelper-map-container", {
                center: new TMap.LatLng(lat, lng),
                zoom: 13
            })

            //https://lbs.qq.com/webApi/javascriptGL/glDoc/glDocMarker
            this.makerLayer = new TMap.MultiMarker({
                map: this.map
            })

            //附加库：地图工具 使用此库 地图会变成 2D 的
            //https://lbs.qq.com/webApi/javascriptGL/glGuide/glEditor
            //https://lbs.qq.com/webApi/javascriptGL/glDoc/glDocEditor
            this.geometryEditor = new TMap.tools.GeometryEditor({
                map: this.map,
                overlayList: [
                    {
                        id: 'polygon',
                        // https://lbs.qq.com/webApi/javascriptGL/glDoc/glDocVector#7
                        overlay: new TMap.MultiPolygon({
                            map: this.map,
                            zIndex: this.overlayZIndex
                        }),
                    },
                    {
                        id: 'circle',
                        // https://lbs.qq.com/webApi/javascriptGL/glDoc/glDocVector#13
                        overlay: new TMap.MultiCircle({
                            map: this.map,
                        }),
                    },
                    {
                        id: 'rectangle',
                        // https://lbs.qq.com/webApi/javascriptGL/glDoc/glDocVector#MultiRectangle
                        overlay: new TMap.MultiRectangle({
                            map: this.map,
                        }),
                    },
                    {
                        id: 'ellipse',
                        // https://lbs.qq.com/webApi/javascriptGL/glDoc/glDocVector#MultiEllipse
                        overlay: new TMap.MultiEllipse({
                            map: this.map,
                        }),
                    },
                ],
                actionMode: TMap.tools.constants.EDITOR_ACTION.INTERACT,
                activeOverlayId: "polygon",
                snappable: true,
                selectable: true
            })

            this.initMapConstant()
            this.initMapListen()

            this.setZoomControl("bottom-left", true)
            this.removeControl("rotation")

            if (this._options.created && typeof this._options.created === "function") {
                this._options.created.call(this)
            }
        }

        initMapConstant() {
            this.controlTypeMap = {
                scale: TMap.constants.DEFAULT_CONTROL_ID.SCALE,
                zoom: TMap.constants.DEFAULT_CONTROL_ID.ZOOM,
                rotation: TMap.constants.DEFAULT_CONTROL_ID.ROTATION,
            }

            this.controlPositionMap = {
                "top-left": TMap.constants.CONTROL_POSITION.TOP_LEFT,
                "top-center": TMap.constants.CONTROL_POSITION.TOP_CENTER,
                "top-right": TMap.constants.CONTROL_POSITION.TOP_RIGHT,
                "center-left": TMap.constants.CONTROL_POSITION.CENTER_LEFT,
                "center": TMap.constants.CONTROL_POSITION.CENTER,
                "center-right": TMap.constants.CONTROL_POSITION.CENTER_RIGHT,
                "bottom-left": TMap.constants.CONTROL_POSITION.BOTTOM_LEFT,
                "bottom-center": TMap.constants.CONTROL_POSITION.BOTTOM_CENTER,
                "bottom-right": TMap.constants.CONTROL_POSITION.BOTTOM_RIGHT,
            }

            this.editorModeMap = {
                draw: TMap.tools.constants.EDITOR_ACTION.DRAW,
                interact: TMap.tools.constants.EDITOR_ACTION.INTERACT,
            }
        }

        initMapListen() {
            this.mapListen()
            this.geometryEditorListen()
        }

        mapListen() {
            const _this = this

            this.map.on("mousemove", function (event) {
                let lat = event.latLng.getLat().toFixed(6);
                let lng = event.latLng.getLng().toFixed(6);
                $(".addrhelper-getpoint-tips").css({
                    top: event.point.y + 18,
                    left: event.point.x + 18
                }).html(`${lat},${lng}`).show()

                // 鼠标吸附效果
                // $("#addrhelper-map-container").addClass("addrhelper-cursor-point")
            })

            this.map.on("mouseout", function (event) {
                // $("#addrhelper-map-container").removeClass("addrhelper-cursor-point")
                $(".addrhelper-getpoint-tips").hide()
            })

            this.map.on("click", async function (event) {
                if (!_this.isDrawMode()) {
                    let lat = event.latLng.getLat().toFixed(6)
                    let lng = event.latLng.getLng().toFixed(6)
                    _this.setMakerLayer(lat, lng)
                    const geocoderResponse = await _this.geocoder(lat, lng)
                    if (geocoderResponse.status === 0) {
                        const result = geocoderResponse.result
                        _this.reloadSelectAddress(lat, lng, result?.formatted_addresses?.recommend ?? "", result.address)
                        _this.setMapCenter(lat, lng)
                    }
                    // 隐藏搜索结果
                    if (_this.suggestionOptions !== null) {
                        $(".addrhelper-search-suggestion .addrhelper-search-list").hide()
                        $(".addrhelper-search-suggestion .addrhelper-search-show-btn").css("height", 38)
                        $(".addrhelper-search-suggestion .addrhelper-search-address").removeClass("addrhelper-search-address-active")
                    }
                }
            })
        }

        geometryEditorListen() {
            const _this = this

            this.geometryEditor.on("draw_complete", function (geometry) {
                ++_this.overlayZIndex
                const activeOverlay = _this.getActiveOverlay()
                activeOverlay.overlay.setZIndex(_this.overlayZIndex)
                // console.log(activeOverlay.overlay.geometries)
            })

            this.geometryEditor.on("select", function (geometry) {
                _this.selectGeometry = _this.geometryEditor.getSelectedList().pop()
            })

            this.geometryEditor.on("delete_complete", function (geometries) {
                let findIndex = geometries.findIndex(function (item) {
                    return item.id === _this.selectGeometry.id
                })
                findIndex !== -1 && (_this.selectGeometry = null)
            })

            this.geometryEditor.on('split_fail', function (res) {
                layer.msg(res.message)
            })

            this.geometryEditor.on('union_fail', function (res) {
                layer.msg(res.message)
            })
        }

        eventListen() {
            this.inputListen()
            this.addressSelectListen()
            this.showListListen()
            this.baseMapListen()
            this.toolListen()
        }

        /**
         * 搜索监听
         */
        inputListen() {
            const _this = this
            $("body").on('input', ".addrhelper-search-input", Utils.debounce(async function (event) {
                if (event.currentTarget.value) {
                    let region = _this.locationInfo ? _this.locationInfo.ad_info.city : ""
                    const suggestionReturn = await _this.suggestion(this.value, region)
                    let suggestion = ""
                    if (suggestionReturn.status === 0) {
                        _this.suggestionOptions = suggestionReturn.data
                        suggestionReturn.data.forEach(function (item, index, arr) {
                            suggestion += `
                                <div class="addrhelper-search-address" data-info='${JSON.stringify(item)}'>
                                    <div class="border">
                                        <div class="index">${index + 1}</div>
                                        <div class="info">
                                            <div class="title">${item.title} </div>
                                            <div class="address">${item.address}</div>
                                        </div>
                                    </div>
                                </div>`
                        })
                        $('.addrhelper-search-suggestion .addrhelper-search-show-btn').css("height", 0)
                        $('.addrhelper-search-suggestion .addrhelper-search-list').html(suggestion).show()
                    }
                } else {
                    $('.addrhelper-search-suggestion .addrhelper-search-list').html("")
                    $('.addrhelper-search-suggestion .addrhelper-search-show-btn').css("height", 0)
                    _this.suggestionOptions = null
                    _this.locationInfo && _this.setMapCenter(_this.locationInfo.location.lat, _this.locationInfo.location.lng)
                }
            }, 500))
        }

        /**
         * 地址选中监听
         */
        addressSelectListen() {
            const _this = this
            $("body").on("click", ".addrhelper-search-address", function (event) {
                $(".addrhelper-search-address").removeClass("addrhelper-search-address-active")
                $(this).addClass("addrhelper-search-address-active")
                const adInfo = JSON.parse(event.currentTarget.dataset.info)
                _this.reloadSelectAddress(adInfo.location.lat, adInfo.location.lng, adInfo.title, adInfo.address, adInfo.id)
                _this.setMapCenter(adInfo.location.lat, adInfo.location.lng)
                _this.setMakerLayer(adInfo.location.lat, adInfo.location.lng)
            })
        }

        /**
         * 地址展开监听
         */
        showListListen() {
            $("body").on("click", ".addrhelper-search-suggestion .addrhelper-search-show-btn", function () {
                $(this).css("height", 0)
                $(".addrhelper-search-suggestion .addrhelper-search-list").show()
            })
        }

        /**
         * 底图监听
         */
        baseMapListen() {
            const _this = this
            $("body").on("click", ".addrhelper-satellite", function () {
                let baseMapType = ""
                if ($(this).hasClass("addrhelper-satellite-active")) {
                    $(this).removeClass("addrhelper-satellite-active")
                    $(this).find(".icon").removeClass("icon-active")
                    baseMapType = "vector"
                } else {
                    $(this).addClass("addrhelper-satellite-active")
                    $(this).find(".icon").addClass("icon-active")
                    baseMapType = "satellite"
                }
                _this.map.setBaseMap({type: baseMapType})
            })
        }

        /**
         * 工具监听
         */
        toolListen() {
            let activeTool = $(".addrhelper-toolbar .tool-marker")
            const _this = this
            $("body").on("click", ".addrhelper-toolbar", function (event) {
                if (event.target !== event.currentTarget) {
                    let action = event.target.dataset.action
                    const actionMap = {
                        delete: function () {
                            _this.geometryEditor.delete()
                        },
                        split: function () {
                            _this.geometryEditor.split()
                        },
                        union: function () {
                            _this.geometryEditor.union()
                        },
                        other: function () {
                            if (action !== "marker") {
                                _this.setEditorMode("draw")
                                _this.geometryEditor.setActiveOverlay(action)
                            } else {
                                _this.setEditorMode("interact")
                                _this.geometryEditor.stop()
                            }
                            activeTool && activeTool.removeClass("tool-active")
                            activeTool = $(event.target)
                            activeTool.addClass("tool-active")
                        }
                    }
                    const actionFunc = actionMap[action] === undefined ? actionMap.other : actionMap[action]
                    actionFunc()
                }
            })
        }

        /**
         * 渲染选中地址
         * @param lat
         * @param lng
         * @param title
         * @param address
         * @param poi
         */
        reloadSelectAddress(lat, lng, title, address, poi = "") {
            $('.addrhelper-getpoint-info .title').html(title)
            $('.addrhelper-getpoint-info .lat').html(lat)
            $('.addrhelper-getpoint-info .lng').html(lng)
            $('.addrhelper-getpoint-info .address').html(address)
            $('.addrhelper-getpoint-info .poi').html(poi)
            this.selectAddressInfo = {lat, lng, title, address, poi}
        }

        /**
         * 设置地图中心
         * @param lat
         * @param lng
         * @link https://lbs.qq.com/webApi/javascriptGL/glGuide/glMap
         * @link https://lbs.qq.com/webApi/javascriptGL/glDoc/docIndexMap
         */
        setMapCenter(lat, lng) {
            this.map.easeTo(
                {center: new TMap.LatLng(lat, lng)}
            )
            // this.map.setCenter(new TMap.LatLng(lat, lng))
        }

        /**
         * 点标记
         * @param lat
         * @param lng
         * @link https://lbs.qq.com/webApi/javascriptGL/glGuide/glMarker
         * @link https://lbs.qq.com/webApi/javascriptGL/glDoc/glDocMarker
         */
        setMakerLayer(lat, lng) {
            this.makerLayer.setGeometries([])
            this.makerLayer.add([{
                position: new TMap.LatLng(lat, lng)
            }])
        }

        /**
         * 控件
         * @link https://lbs.qq.com/webApi/javascriptGL/glGuide/glMarker
         * @link https://lbs.qq.com/webApi/javascriptGL/glDoc/glDocControl
         * @param type
         * @returns {*}
         */
        getControl(type) {
            if (this.controlTypeMap[type] === undefined) {
                throw new Error("控件type非法")
            }
            return this.map.getControl(this.controlTypeMap[type])
        }

        /**
         * 移除控件
         * @param type
         * @returns {*}
         */
        removeControl(type) {
            if (this.controlTypeMap[type] === undefined) {
                throw new Error("控件type非法")
            }
            return this.map.removeControl(this.controlTypeMap[type])
        }

        /**
         * 设置缩放控件
         * @param position
         * @param numVisible
         * @returns {*}
         */
        setZoomControl(position = "bottom-right", numVisible = false) {
            if (this.controlPositionMap[position] === undefined) {
                position = "bottom-right"
            }
            return this.map.getControl("zoom").setPosition(this.controlPositionMap[position]).setNumVisible(numVisible)
        }

        /**
         * 是否是绘画模式
         * @returns {boolean}
         */
        isDrawMode() {
            return this.geometryEditor.getActionMode() === this.editorModeMap["draw"]
        }

        /**
         * 设置编辑器模式
         * @param mode
         */
        setEditorMode(mode) {
            if (this.editorModeMap[mode] === undefined) {
                throw new Error("编辑器操作模式mode非法")
            }
            this.geometryEditor.setActionMode(this.editorModeMap[mode])
        }

        /**
         * 获取处于编辑状态的图层
         * @returns {*}
         */
        getActiveOverlay() {
            return this.geometryEditor.getActiveOverlay()
        }

        /**
         * 绘制多边形
         * @param styles 图层样式
         * @param geometries 多边形数据
         * @param editable 是否可编辑
         * @param zIndex 图层顺序
         * @returns {TMap.MultiPolygon|*}
         * @link https://lbs.qq.com/webApi/javascriptGL/glDoc/glDocVector#7
         * @link https://lbs.qq.com/webApi/javascriptGL/glDoc/glDocVector#10
         *
         */
        drawMultiPolygon(styles, geometries, editable = false, zIndex = 0) {
            if (!styles instanceof Object) {
                throw new Error("styles参数必须是对象")
            }
            if (!Array.isArray(geometries)) {
                throw new Error("geometries参数必须是数组")
            }

            const styleArr = []
            for (let key in styles) {
                if (styles[key].borderColor !== undefined || styles[key].borderWidth !== undefined) {
                    styles[key].showBorder = true
                }
                if (styles[key].borderWidth === undefined) {
                    styles[key].borderWidth = 1
                }
                styles[key] = new TMap.PolygonStyle(styles[key])
                styleArr.push(key)
            }

            for (let geometry of geometries) {
                if (geometry.styleId === undefined) {
                    throw new Error("geometries缺少styleId属性")
                }
                if (!styleArr.includes(geometry.styleId)) {
                    throw new Error("geometries的styleId属性值非法")
                }
                if (geometry.paths === undefined) {
                    throw new Error("geometries缺少paths属性")
                }
                if (!Array.isArray(geometry.paths)) {
                    throw new Error("geometries的paths属性值必须是数组")
                }

                geometry.paths = geometry.paths.map(function (path) {
                    if (path.lat === undefined || path.lng === undefined) {
                        throw new Error("geometries的paths属性值格式非法")
                    }
                    return new TMap.LatLng(path.lat, path.lng);
                })
            }

            if (editable) {
                const activeOverlay = this.getActiveOverlay().overlay
                activeOverlay.setStyles(styles)
                activeOverlay.add(geometries)
                return activeOverlay
            } else {
                return new TMap.MultiPolygon({
                    map: this.map,
                    styles: styles,
                    geometries: geometries,
                    zIndex: zIndex
                })
            }
        }

        /**
         * IP定位
         * @returns {*}
         * @link https://lbs.qq.com/service/webService/webServiceGuide/webServiceIp
         */
        ipLocation() {
            return this.request.get("/ws/location/v1/ip")
        }

        /**
         * 关键词输入提示
         * @param keyword
         * @param region
         * @param regionFix
         * @returns {*}
         * @link https://lbs.qq.com/service/webService/webServiceGuide/webServiceSuggestion
         */
        suggestion(keyword, region = "", regionFix = 0) {
            return this.request.get('/ws/place/v1/suggestion', {
                keyword,
                region,
                region_fix: regionFix
            })
        }

        /**
         * 逆地址解析（坐标位置描述）
         * @param lat
         * @param lng
         * @returns {*}
         * @link https://lbs.qq.com/service/webService/webServiceGuide/webServiceGcoder
         */
        geocoder(lat, lng) {
            return this.request.get('/ws/geocoder/v1', {
                location: `${lat},${lng}`
            })
        }
    }

    exports(MOD_NAME, new AddrHelper());
})