"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var style_scss_1 = require("./style.scss");
var gtk3_1 = require("astal/gtk3");
var Bar_js_1 = require("./Widget/Bar.js");
gtk3_1.App.start({
    css: style_scss_1.default,
    instanceName: "astal",
    requestHandler: function (request, res) {
        print(request);
        res("ok");
    },
    main: function () {
        gtk3_1.App.get_monitors().map(Bar_js_1.default);
    }
});
