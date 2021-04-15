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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestContext = exports.convertKitPayload = exports.fetchQuery = exports.getEnvironment = exports.setEnvironment = exports.Environment = void 0;
var Environment = /** @class */ (function () {
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
var currentEnv = null;
function setEnvironment(env) {
    currentEnv = env;
}
exports.setEnvironment = setEnvironment;
function getEnvironment() {
    return currentEnv;
}
exports.getEnvironment = getEnvironment;
// fetchQuery is used by the preprocess-generated runtime to send an operation to the server
function fetchQuery(ctx, _a, session) {
    var text = _a.text, variables = _a.variables;
    return __awaiter(this, void 0, void 0, function () {
        var environment;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    environment = getEnvironment();
                    // if there is no environment
                    if (!environment) {
                        return [2 /*return*/, { data: {}, errors: [{ message: 'could not find houdini environment' }] }];
                    }
                    return [4 /*yield*/, environment.sendRequest(ctx, { text: text, variables: variables }, session)];
                case 1: return [2 /*return*/, _b.sent()];
            }
        });
    });
}
exports.fetchQuery = fetchQuery;
// convertKitPayload is responsible for taking the result of kit's load
function convertKitPayload(context, loader, page, session) {
    return __awaiter(this, void 0, void 0, function () {
        var fetchContext, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fetchContext = {
                        page: page,
                        session: session,
                        context: context,
                        fetch: context.fetch,
                    };
                    return [4 /*yield*/, loader(fetchContext)
                        // if the response contains an error
                    ];
                case 1:
                    result = _a.sent();
                    // if the response contains an error
                    if (result.error) {
                        // 500 - internal server error
                        context.error(result.status || 500, result.error);
                        return [2 /*return*/];
                    }
                    // if the response contains a redirect
                    if (result.redirect) {
                        // 307 - temporary redirect
                        context.redirect(result.status || 307, result.redirect);
                        return [2 /*return*/];
                    }
                    // the response contains data!
                    if (result.props) {
                        return [2 /*return*/, result.props];
                    }
                    // we shouldn't get here
                    throw new Error('Could not handle response from loader: ' + JSON.stringify(result));
            }
        });
    });
}
exports.convertKitPayload = convertKitPayload;
var RequestContext = /** @class */ (function () {
    function RequestContext(ctx) {
        this.continue = true;
        this.returnValue = {};
        this.context = ctx;
    }
    RequestContext.prototype.error = function (status, message) {
        this.continue = false;
        this.returnValue = {
            error: message,
            status: status,
        };
    };
    RequestContext.prototype.redirect = function (status, location) {
        this.continue = false;
        this.returnValue = {
            redirect: location,
            status: status,
        };
    };
    RequestContext.prototype.fetch = function (input, init) {
        return this.context.fetch(input, init);
    };
    RequestContext.prototype.graphqlErrors = function (errors) {
        console.log('registering graphql errors');
        return this.error(500, errors.map(function (_a) {
            var message = _a.message;
            return message;
        }).join('\n'));
    };
    RequestContext.prototype.computeInput = function (mode, func) {
        // if we are in kit mode, just pass the context directly
        if (mode === 'kit') {
            return func(this.context);
        }
        // we are in sapper mode, so we need to prepare the function context
        // and pass page and session
        return func.call(this, this.context.page, this.context.session);
    };
    return RequestContext;
}());
exports.RequestContext = RequestContext;
