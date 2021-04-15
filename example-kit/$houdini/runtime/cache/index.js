"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var cache_1 = require("./cache");
var localCache = new cache_1.Cache();
if (global.window) {
    // @ts-ignore
    window.cache = localCache;
}
exports.default = localCache;
