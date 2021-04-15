"use strict";
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
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionHandler = void 0;
var ConnectionHandler = /** @class */ (function () {
    function ConnectionHandler(_a) {
        var name = _a.name, cache = _a.cache, record = _a.record, key = _a.key, connectionType = _a.connectionType, selection = _a.selection, when = _a.when, filters = _a.filters, parentID = _a.parentID;
        this.record = record;
        this.key = key;
        this.connectionType = connectionType;
        this.cache = cache;
        this.selection = selection;
        this._when = when;
        this.filters = filters;
        this.name = name;
        this.parentID = parentID;
    }
    // when applies a when condition to a new connection pointing to the same spot
    ConnectionHandler.prototype.when = function (when) {
        return new ConnectionHandler({
            cache: this.cache,
            record: this.record,
            key: this.key,
            connectionType: this.connectionType,
            selection: this.selection,
            when: when,
            filters: this.filters,
            parentID: this.parentID,
            name: this.name,
        });
    };
    ConnectionHandler.prototype.append = function (selection, data, variables) {
        if (variables === void 0) { variables = {}; }
        return this.addToConnection(selection, data, variables, 'last');
    };
    ConnectionHandler.prototype.prepend = function (selection, data, variables) {
        if (variables === void 0) { variables = {}; }
        return this.addToConnection(selection, data, variables, 'first');
    };
    ConnectionHandler.prototype.addToConnection = function (selection, data, variables, where) {
        var _a;
        if (variables === void 0) { variables = {}; }
        // if there are conditions for this operation
        if (!this.validateWhen()) {
            return;
        }
        // figure out the id of the type we are adding
        var dataID = this.cache.id(this.connectionType, data);
        // update the cache with the data we just found
        this.cache.write(selection, data, variables, dataID);
        if (where === 'first') {
            // add the record we just created to the list
            this.record.prependLinkedList(this.key, dataID);
        }
        else {
            // add the record we just created to the list
            this.record.appendLinkedList(this.key, dataID);
        }
        // get the list of specs that are subscribing to the connection
        var subscribers = this.record.getSubscribers(this.key);
        // notify the subscribers we care about
        this.cache.internal.notifySubscribers(subscribers, variables);
        // look up the new record in the cache
        var newRecord = this.cache.internal.record(dataID);
        // add the connection reference
        newRecord.addConnectionReference({
            parentID: this.parentID,
            name: this.name,
        });
        // walk down the connection fields relative to the new record
        // and make sure all of the connection's subscribers are listening
        // to that object
        (_a = this.cache.internal).insertSubscribers.apply(_a, __spread([newRecord, this.selection, variables], subscribers));
    };
    ConnectionHandler.prototype.removeID = function (id, variables) {
        var _a;
        if (variables === void 0) { variables = {}; }
        // if there are conditions for this operation
        if (!this.validateWhen()) {
            return;
        }
        // add the record we just created to the list
        this.record.removeFromLinkedList(this.key, id);
        // get the list of specs that are subscribing to the connection
        var subscribers = this.record.getSubscribers(this.key);
        // notify the subscribers about the change
        this.cache.internal.notifySubscribers(subscribers, variables);
        // disconnect record from any subscriptions associated with the connection
        (_a = this.cache.internal).unsubscribeSelection.apply(_a, __spread([this.cache.internal.record(id),
            this.selection,
            variables], subscribers.map(function (_a) {
            var set = _a.set;
            return set;
        })));
    };
    ConnectionHandler.prototype.remove = function (data, variables) {
        if (variables === void 0) { variables = {}; }
        // figure out the id of the type we are adding
        this.removeID(this.cache.id(this.connectionType, data), variables);
    };
    ConnectionHandler.prototype.validateWhen = function () {
        // if this when doesn't apply, we should look at others to see if we should update those behind the scenes
        var ok = true;
        // if there are conditions for this operation
        if (this._when) {
            // we only NEED there to be target filters for must's
            var targets_1 = this.filters;
            // check must's first
            if (this._when.must && targets_1) {
                ok = Object.entries(this._when.must).reduce(function (prev, _a) {
                    var _b = __read(_a, 2), key = _b[0], value = _b[1];
                    return Boolean(prev && targets_1[key] == value);
                }, ok);
            }
            // if there are no targets, nothing could be true that can we compare against
            if (this._when.must_not) {
                ok =
                    !targets_1 ||
                        Object.entries(this._when.must_not).reduce(function (prev, _a) {
                            var _b = __read(_a, 2), key = _b[0], value = _b[1];
                            return Boolean(prev && targets_1[key] != value);
                        }, ok);
            }
        }
        return ok;
    };
    // iterating over the connection handler should be the same as iterating over
    // the underlying linked list
    ConnectionHandler.prototype[Symbol.iterator] = function () {
        var _a, _b, record, e_1_1;
        var e_1, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 5, 6, 7]);
                    _a = __values(this.record.linkedList(this.key)), _b = _a.next();
                    _d.label = 1;
                case 1:
                    if (!!_b.done) return [3 /*break*/, 4];
                    record = _b.value;
                    return [4 /*yield*/, record];
                case 2:
                    _d.sent();
                    _d.label = 3;
                case 3:
                    _b = _a.next();
                    return [3 /*break*/, 1];
                case 4: return [3 /*break*/, 7];
                case 5:
                    e_1_1 = _d.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 7];
                case 6:
                    try {
                        if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                    }
                    finally { if (e_1) throw e_1.error; }
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    };
    return ConnectionHandler;
}());
exports.ConnectionHandler = ConnectionHandler;
