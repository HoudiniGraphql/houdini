"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphql = exports.subscription = exports.fragment = exports.mutation = exports.getQuery = exports.query = void 0;
__exportStar(require("./network"), exports);
__exportStar(require("./types"), exports);
var query_1 = require("./query");
Object.defineProperty(exports, "query", { enumerable: true, get: function () { return __importDefault(query_1).default; } });
Object.defineProperty(exports, "getQuery", { enumerable: true, get: function () { return query_1.getQuery; } });
var mutation_1 = require("./mutation");
Object.defineProperty(exports, "mutation", { enumerable: true, get: function () { return __importDefault(mutation_1).default; } });
var fragment_1 = require("./fragment");
Object.defineProperty(exports, "fragment", { enumerable: true, get: function () { return __importDefault(fragment_1).default; } });
var subscription_1 = require("./subscription");
Object.defineProperty(exports, "subscription", { enumerable: true, get: function () { return __importDefault(subscription_1).default; } });
// this template tag gets removed by the preprocessor so it should never be invoked.
// this function needs to return the same value as what the preprocessor leaves behind for type consistency
function graphql(str) {
    // if this is executed, the preprocessor is not enabled
    throw new Error("Looks like you don't have the preprocessor enabled. Encountered it at runtime wrapping: \n " +
        str[0]);
}
exports.graphql = graphql;
