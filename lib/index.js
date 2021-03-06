"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * 使用方法：
    import WebPerformance from 'web-performance-report'

    // 使用 GET 上报到指定地址
	WebPerformance({
	  url: 'http://sdfasdf.com',   // 上报的地址
	  disabled: false,
	  reportError: true,
	  reportResource: true
	})

    // 自定义方法上报
    WebPerformance({}, (data) => {
      fetch('http://xxx.com/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
    })
 */
// 默认通过Get参数发送数据，reportResource 可能会超过get参数的大小限制，含有 reportResource 建议用自定义回调发送
(function () {
  var MARK_USER_FLAG = 'web_performace_markuser';
  var Mark_USER = markUser();
  var ReportUrl, ReportCallback;

  function WebPerformance() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var callback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};
    var _options$url = options.url,
        url = _options$url === void 0 ? '' : _options$url,
        _options$disabled = options.disabled,
        disabled = _options$disabled === void 0 ? false : _options$disabled,
        _options$reportResour = options.reportResource,
        reportResource = _options$reportResour === void 0 ? false : _options$reportResour,
        _options$reportError = options.reportError,
        reportError = _options$reportError === void 0 ? false : _options$reportError;
    ReportUrl = url;
    ReportCallback = callback;
    if (disabled) return;

    if (reportError) {
      bindErrorListener();
    }

    window.onload = function (e) {
      // 不延迟 performance.timing.loadEventEnd 会为0
      window.setTimeout(function () {
        var data = _objectSpread({
          type: 'performance',
          url: window.location.href
        }, getPerformanceInfo());

        if (reportResource) {
          data.resources = getResourceInfo();
        }

        reportData(data);
      }, 200);
    };
  }

  function getPerformanceInfo() {
    if (!window.performance) return null;
    var _performance$timing = performance.timing,
        domainLookupEnd = _performance$timing.domainLookupEnd,
        domainLookupStart = _performance$timing.domainLookupStart,
        connectEnd = _performance$timing.connectEnd,
        connectStart = _performance$timing.connectStart,
        responseStart = _performance$timing.responseStart,
        navigationStart = _performance$timing.navigationStart,
        domContentLoadedEventEnd = _performance$timing.domContentLoadedEventEnd,
        loadEventEnd = _performance$timing.loadEventEnd,
        fetchStart = _performance$timing.fetchStart,
        redirectEnd = _performance$timing.redirectEnd,
        redirectStart = _performance$timing.redirectStart,
        loadEventStart = _performance$timing.loadEventStart,
        unloadEventEnd = _performance$timing.unloadEventEnd,
        unloadEventStart = _performance$timing.unloadEventStart,
        responseEnd = _performance$timing.responseEnd,
        requestStart = _performance$timing.requestStart,
        domComplete = _performance$timing.domComplete,
        domInteractive = _performance$timing.domInteractive,
        domLoading = _performance$timing.domLoading;
    return {
      // DNS解析时间
      dns: domainLookupEnd - domainLookupStart || 0,
      //TCP建立时间
      tcp: connectEnd - connectStart || 0,
      // 白屏时间  
      whiteScreen: responseStart - navigationStart || 0,
      //页面解析dom耗时
      dom: domComplete - domInteractive || 0,
      //dom渲染完成时间
      domReady: domContentLoadedEventEnd - navigationStart || 0,
      //页面onload时间
      load: loadEventEnd - navigationStart || 0,
      // 页面准备时间 
      ready: fetchStart - navigationStart || 0,
      // unload时间
      unload: unloadEventEnd - unloadEventStart || 0,
      //request请求耗时
      request: responseEnd - requestStart || 0
    };
  } // 统计页面资源


  function getResourceInfo() {
    if (!window.performance && !window.performance.getEntries) return null;
    var resources = performance.getEntriesByType('resource');
    if (!resources && !resources.length) return false;
    return resources.map(function (item) {
      return {
        name: item.name,
        type: item.initiatorType,
        duration: item.duration || 0,
        decodedBodySize: item.decodedBodySize || 0
      };
    });
  } // 绑定错误上报


  function bindErrorListener() {
    var baseInfo = {
      type: 'error',
      url: window.location.href,
      msg: '',
      info: {}
    }; // img,script,css,jsonp

    window.addEventListener('error', function (e) {
      var info = _objectSpread({}, baseInfo, {
        msg: "[resource] ".concat(e.target.localName, " is load error"),
        info: {
          target: e.target.localName,
          type: e.type,
          resourceUrl: e.target.href || e.target.currentSrc
        }
      });

      if (e.target !== window) {
        reportData(info);
      }
    }, true); // js

    window.onerror = function (msg, url, line, col, error) {
      setTimeout(function () {
        var info = _objectSpread({}, baseInfo, {
          msg: "[js] ".concat(msg),
          info: {
            resourceUrl: url,
            line: line
          }
        });

        reportData(info);
      }, 0);
    };

    window.addEventListener('unhandledrejection', function (e) {
      var error = e && e.reason;
      var message = error.message || '';
      var stack = error.stack || '';
      var resourceUrl, col, line;
      var errs = stack.match(/\(.+?\)/);
      if (errs && errs.length) errs = errs[0];
      errs = errs.replace(/\w.+[js|html]/g, function ($1) {
        resourceUrl = $1;
        return '';
      });
      errs = errs.split(':');
      if (errs && errs.length > 1) line = parseInt(errs[1] || 0);
      col = parseInt(errs[2] || 0);

      var info = _objectSpread({}, baseInfo, {
        msg: "[js] ".concat(message),
        info: {
          resourceUrl: resourceUrl,
          line: col,
          col: line
        }
      });

      reportData(info);
    });
  } // 生成随机数


  function randomString(len) {
    len = len || 10;
    var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz123456789';
    var maxPos = $chars.length;
    var pwd = '';

    for (var i = 0; i < len; i++) {
      pwd = pwd + $chars.charAt(Math.floor(Math.random() * maxPos));
    }

    return pwd;
  } // 生成用户标识，区分哪些资源是同一个用户上报的


  function markUser() {
    var mark = sessionStorage.getItem(MARK_USER_FLAG) || '';

    if (!mark) {
      mark = randomString();
      sessionStorage.setItem(MARK_USER_FLAG, mark);
    }

    return mark;
  } // 上报数据


  function reportData(data) {
    ReportCallback(data);
    if (!ReportUrl || !data) return;

    var reportData = _objectSpread({}, data, {
      mark: Mark_USER,
      time: new Date().getTime()
    });

    var dataString = encodeURIComponent(JSON.stringify(reportData));
    var url = "".concat(ReportUrl).concat(ReportUrl.indexOf('?') > -1 ? '&' : '?', "data=").concat(dataString);
    var imgElement = new Image();
    imgElement.src = url;

    imgElement.onload = imgElement.onerror = function () {
      imgElement = null;
    };
  }

  if (typeof require === 'function' && (typeof exports === "undefined" ? "undefined" : _typeof(exports)) === "object" && (typeof module === "undefined" ? "undefined" : _typeof(module)) === "object") {
    module.exports = WebPerformance;
  } else {
    window.WebPerformance = WebPerformance;
  }
})();
