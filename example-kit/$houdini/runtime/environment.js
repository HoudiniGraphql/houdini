"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Environment = void 0;
var Environment = /** @class */ (function () {
    // this project uses subscriptions so make sure one is passed when constructing an environment
    function Environment(networkFn, subscriptionHandler) {
        this.fetch = networkFn;
        this.socket = subscriptionHandler;
    }
    Environment.prototype.sendRequest = function (ctx, params, session) {
        return this.fetch.call(ctx, params, session);
    };
    return Environment;
}());
exports.Environment = Environment;
