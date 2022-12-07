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
        map = null
        makerLayer = null
        request = null
        locationInfo = null
        selectAddressInfo = null

        render(options) {
            if (options.key === undefined || !options.key) {
                throw new Error("参数key必传")
            }
            if (options.width === undefined || !options.width) {
                options.width = '80vw'
            }
            if (options.height === undefined || !options.height) {
                options.height = '80vh'
            }
            this.request = new Request("https://apis.map.qq.com").jsonp().extraData({key: options.key, output: "jsonp"})
            this.dynamicLoadHtml(options)
            this.dynamicLoadCss()
            this.listen()
            //注意：不支持file://方式使用Javascript API GL 详见 https://lbs.qq.com/webApi/javascriptGL/glGuide/glBasic
            this.dynamicLoadJs(`https://map.qq.com/api/gljs?v=1.exp&key=${options.key}`, () => {
                if (options.lat !== undefined && options.lat && options.lng !== undefined && options.lng) {
                    this.initMap(Number(options.lat), Number(options.lng))
                } else {
                    this.initMap()
                }
            })
        }

        dynamicLoadHtml(options) {
            const _this = this
            layer.open({
                type: 1,
                title: "坐标拾取器",
                content: `
                    <div class="addrhelper-getpoint">
                        <div class="addrhelper-getpoint-map">
                            <div id="addrhelper-map-container"></div>
                            <div class="addrhelper-getpoint-search">
                                <input type="text" class="addrhelper-search-input" placeholder="输入地址" value="">
                            </div>
                            <div class="addrhelper-getpoint-tips"></div>
                        </div>
                        <div class="addrhelper-getpoint-info">
                            <div class="title">点图获取坐标</div>
                            <div class="item">
                                <p class="label">经度</p>
                                <div class="input lng"></div>
                            </div>
                            <div class="item">
                                <p class="label">纬度</p>
                                <div class="input lat"></div>
                            </div>
                            <div class="item">
                                <p class="label">地址</p>
                                <div class="input address"></div>
                            </div>
                            <div class="item">
                                <p class="label">POI ID</p>
                                <div class="input poi"></div>
                            </div>
                        </div>
                    </div>
                    <div class="addrhelper-search-suggestion"></div>`,
                area: [options.width, options.height],
                btn: ['确定', '取消'],
                maxmin: true,
                yes: function (index, layero) {
                    if (!_this.selectAddressInfo) {
                        layer.msg("请选择地址后再提交", {icon: 2})
                        return
                    }
                    layer.close(index)
                    if (options.success !== undefined && typeof options.success === "function") {
                        options.success(_this.selectAddressInfo)
                    }
                },
                cancel: function () {
                    //右上角关闭回调
                    //return false 开启该代码可禁止点击该按钮关闭
                }
            })
        }

        dynamicLoadCss() {
            if (!$('#addrHelperCSS').length) {
                $("head").append(`
                    <style id="addrHelperCSS">
                        /* 获取坐标容器 */
                        .addrhelper-getpoint {
                            position: relative;
                            height: 100%;
                            width: 100%;
                            display: flex;
                        }
                        
                        /* 获取坐标地图 */
                        .addrhelper-getpoint-map {
                            width: 70%;
                        }
                        
                        .addrhelper-getpoint-map #addrhelper-map-container {
                            height: 100%;
                            width: 100%;
                        }
                        
                        .addrhelper-getpoint-map .addrhelper-getpoint-search {
                            display: flex;
                            position: absolute;
                            top: 30px;
                            left: 30px;
                            width: 300px;
                            height: 36px;
                            border: 1px solid #F3F3F3;
                            box-sizing: border-box;
                            border-radius: 5px;
                            line-height: 36px;
                            background-color: #FFFFFF;
                            z-index: 9999;
                        }
                        
                        .addrhelper-getpoint-map .addrhelper-getpoint-search:hover {
                            border: 1px solid #CCCCCC;
                        }
                        
                        .addrhelper-getpoint-map .addrhelper-getpoint-search input {
                            width: 100%;
                            flex: 1;
                            padding-left: 8px;
                            border: none;
                            outline: none;
                            border-radius: 5px;
                        }
                        
                        .addrhelper-getpoint-map .addrhelper-getpoint-tips {
                            position: absolute;
                            z-index: 9999;
                            background-color: #484847;
                            color: #FFFFFF;
                            padding: 5px;
                            border-radius: 3px;
                            font-size: 12px;
                        }
                        
                         /* 获取坐标信息 */
                        .addrhelper-getpoint-info {
                            width: 30%;
                            background-color: #FFFFFF;
                            padding: 25px 20px;
                            box-sizing: border-box;
                        }
                        
                        .addrhelper-getpoint-info .title {
                            font-size: 16px;
                            color: #1b202c;
                            letter-spacing: 0;
                            line-height: 24px;
                            font-weight: 600;
                            min-height: 24px;
                        }
                        
                        .addrhelper-getpoint-info .item {
                            margin-top: 20px;
                        }
                        
                        .addrhelper-getpoint-info .label {
                            margin-bottom: 4px;
                            font-size: 14px;
                            color: #1b202c;
                            letter-spacing: 0;
                            line-height: 22px;
                            font-weight: 600;
                        }
                        
                        .addrhelper-getpoint-info .input {
                            padding: 0 40px 0 8px;
                            min-height: 34px;
                            line-height: 34px;
                            background: rgba(27,32,44,.03);
                            border: 1px solid #ced2d9;
                            border-radius: 4px;
                            font-size: 14px;
                            color: #1b202c;
                            font-weight: 400;
                        }
                        
                        /* 地址搜索提示 */
                        .addrhelper-search-suggestion {
                            width: 300px;
                            max-height: 300px;
                            overflow-y: auto;
                            box-sizing: border-box;
                            position: absolute;
                            top: 66px;
                            left: 30px;
                            background-color: #FFFFFF;
                            z-index: 9999;
                        }
                        
                        .addrhelper-search-suggestion::-webkit-scrollbar {
                            width: 6px;
                            height: 6px;
                            background-color: #F5F5F5;
                        }
                        
                        .addrhelper-search-suggestion::-webkit-scrollbar-thumb {
                            background-color: #DDDEE0;
                            background-clip: padding-box;
                            border-radius: 3px;
                        }
                        
                        .addrhelper-search-suggestion .addrhelper-search-address {
                            padding: 12px;
                        } 
                        
                        .addrhelper-search-suggestion .addrhelper-search-address:hover {
                            background-color: #F5F9FF;
                        }
                        
                        .addrhelper-search-suggestion .addrhelper-search-address .title {
                            font-size: 14px;
                            color: #1b202c;
                            line-height: 22px;
                            font-weight: 600;
                            margin-bottom: 4px;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        }
                        
                        .addrhelper-search-suggestion .addrhelper-search-address .address {
                            font-size: 12px;
                            color: #535B6E;
                            line-height: 18px;
                            font-weight: 400;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        }
                        
                        .addrhelper-search-suggestion .addrhelper-search-address-active {
                            background-color: #EBF3FF;
                        } 
                        
                        .addrhelper-search-suggestion .addrhelper-search-address-active .title,
                        .addrhelper-search-suggestion .addrhelper-search-address-active .address {
                            color: #0062FF;
                        } 
                    </style>`
                )
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
            const _this = this

            if (!lat || !lng) {
                let ipLocationReturn = await this.ipLocation()
                if (ipLocationReturn.status === 0) {
                    lat = ipLocationReturn.result.location.lat
                    lng = ipLocationReturn.result.location.lng
                    this.locationInfo = ipLocationReturn.result
                }
            }

            this.map = new TMap.Map("addrhelper-map-container", {
                center: new TMap.LatLng(lat, lng)
            });

            this.makerLayer = new TMap.MultiMarker({
                map: this.map
            })

            this.map.on("mousemove", function (event) {
                let lat = event.latLng.getLat().toFixed(6);
                let lng = event.latLng.getLng().toFixed(6);
                $(".addrhelper-getpoint-tips").css({
                    top: event.point.y + 18,
                    left: event.point.x + 18
                }).html(`${lat},${lng}`).show()

                $("#addrhelper-map-container").css("cursor", "url(https://mapapi.qq.com/web/lbs/static/lbs_home/icon/point1.ico),auto")
            })

            this.map.on("mouseout", function (event) {
                $(".addrhelper-getpoint-tips").hide()
            })

            this.map.on("click", async function (event) {
                let lat = event.latLng.getLat().toFixed(6);
                let lng = event.latLng.getLng().toFixed(6);
                _this.setMakerLayer(lat, lng)
                const geocoderResponse = await _this.geocoder(lat, lng)
                if (geocoderResponse.status === 0) {
                    const result = geocoderResponse.result
                    _this.reloadSelectAddress(lat, lng, result.formatted_addresses.recommend, result.address)
                }
            })
        }

        listen() {
            this.inputListen()
            this.addressSelectListen()
        }

        /**
         * 搜索监听
         */
        inputListen() {
            const _this = this
            $("body").on('input', ".addrhelper-search-input", Utils.debounce(async function () {
                if (this.value) {
                    let region = _this.locationInfo ? _this.locationInfo.ad_info.city : ""
                    const suggestionReturn = await _this.suggestion(this.value, region)
                    let suggestion = ""
                    if (suggestionReturn.status === 0) {
                        suggestionReturn.data.forEach(function (item, index, arr) {
                            suggestion += `
                                <div class="addrhelper-search-address" data-info='${JSON.stringify(item)}'>
                                    <div class="title">${item.title} </div>
                                    <div class="address">${item.address}</div>
                                </div>`
                        })
                        $('.addrhelper-search-suggestion').html(suggestion)
                    }
                } else {
                    $('.addrhelper-search-suggestion').html("")
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
         */
        setMapCenter(lat, lng) {
            this.map.setCenter(new TMap.LatLng(lat, lng))
        }

        /**
         * 点标记
         * @param lat
         * @param lng
         * @link https://lbs.qq.com/webApi/javascriptGL/glGuide/glMarker
         */
        setMakerLayer(lat, lng) {
            this.makerLayer.setGeometries([])
            this.makerLayer.add([{
                position: new TMap.LatLng(lat, lng)
            }])
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