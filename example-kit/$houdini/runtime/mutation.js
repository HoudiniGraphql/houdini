"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// locals
var network_1 = require("./network");
var cache_1 = __importDefault(require("./cache"));
var context_1 = require("./context");
// @ts-ignore: this file will get generated and does not exist in the source code
var adapter_mjs_1 = require("./adapter.mjs");
// mutation returns a handler that will send the mutation to the server when
// invoked
function mutation(document) {
    var _this = this;
    // make sure we got a query document
    if (document.kind !== 'HoudiniMutation') {
        throw new Error('mutation() must be passed a mutation document');
    }
    // pull the query text out of the compiled artifact
    var text = document.artifact.raw;
    // grab the sesion from the adapter
    var session = adapter_mjs_1.getSession();
    var queryVariables = context_1.getVariables();
    // return an async function that sends the mutation go the server
    return function (variables) {
        // we want the mutation to throw an error if the network layer invokes this.error
        return new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
            var result, mutationCtx, _a, data, errors, e_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        mutationCtx = {
                            fetch: window.fetch.bind(window),
                            session: session,
                            context: {},
                            page: {
                                host: '',
                                path: '',
                                params: {},
                                query: new URLSearchParams(),
                            },
                        };
                        return [4 /*yield*/, network_1.fetchQuery(mutationCtx, { text: text, variables: variables }, session)
                            // we could have gotten a null response
                        ];
                    case 1:
                        _a = _b.sent(), data = _a.data, errors = _a.errors;
                        // we could have gotten a null response
                        if (errors) {
                            reject(errors);
                            return [2 /*return*/];
                        }
                        if (!data) {
                            reject([new Error('Encountered empty data response in mutation payload')]);
                            return [2 /*return*/];
                        }
                        result = data;
                        return [3 /*break*/, 3];
                    case 2:
                        e_1 = _b.sent();
                        reject(e_1);
                        return [2 /*return*/];
                    case 3:
                        // update the cache with the mutation data
                        cache_1.default.write(document.artifact.selection, result, queryVariables());
                        // wrap the result in a store we can use to keep this query up to date
                        resolve(result);
                        return [2 /*return*/];
                }
            });
        }); });
    };
}
exports.default = mutation;
