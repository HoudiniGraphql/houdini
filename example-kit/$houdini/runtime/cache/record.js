"use strict";
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
exports.Record = void 0;
// for the most part, this is a very low-level/dumb class that is meant to track state related
// to a specific entity in the cached graph.
var Record = /** @class */ (function () {
    function Record(cache) {
        this.fields = {};
        this.keyVersions = {};
        this.subscribers = {};
        this.recordLinks = {};
        this.listLinks = {};
        this.referenceCounts = {};
        this.connections = [];
        this.cache = cache;
    }
    Record.prototype.allSubscribers = function () {
        return Object.values(this.subscribers).flatMap(function (subscribers) { return subscribers; });
    };
    Record.prototype.getField = function (fieldName) {
        return this.fields[fieldName];
    };
    Record.prototype.writeField = function (fieldName, value) {
        this.fields[fieldName] = value;
    };
    Record.prototype.writeRecordLink = function (fieldName, value) {
        this.recordLinks[fieldName] = value;
    };
    Record.prototype.writeListLink = function (fieldName, value) {
        this.listLinks[fieldName] = value;
    };
    Record.prototype.linkedRecord = function (fieldName) {
        return this.cache.internal.getRecord(this.recordLinks[fieldName]);
    };
    Record.prototype.linkedRecordID = function (fieldName) {
        return this.recordLinks[fieldName];
    };
    Record.prototype.linkedListIDs = function (fieldName) {
        return this.listLinks[fieldName] || [];
    };
    Record.prototype.linkedList = function (fieldName) {
        var _this = this;
        return (this.listLinks[fieldName] || [])
            .map(function (link) { return _this.cache.internal.getRecord(link); })
            .filter(function (record) { return record !== null; });
    };
    Record.prototype.appendLinkedList = function (fieldName, id) {
        // this could be the first time we've seen the list
        if (!this.listLinks[fieldName]) {
            this.listLinks[fieldName] = [];
        }
        this.listLinks[fieldName].push(id);
    };
    Record.prototype.prependLinkedList = function (fieldName, id) {
        // this could be the first time we've seen the list
        if (!this.listLinks[fieldName]) {
            this.listLinks[fieldName] = [];
        }
        this.listLinks[fieldName].unshift(id);
    };
    Record.prototype.removeFromLinkedList = function (fieldName, id) {
        this.listLinks[fieldName] = (this.listLinks[fieldName] || []).filter(function (link) { return link !== id; });
    };
    Record.prototype.addSubscriber = function (rawKey, key) {
        var _a, e_1, _b;
        var specs = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            specs[_i - 2] = arguments[_i];
        }
        // if this is the first time we've seen the raw key
        if (!this.keyVersions[rawKey]) {
            this.keyVersions[rawKey] = new Set();
        }
        // add this verson of the key if we need to
        this.keyVersions[rawKey].add(key);
        // the existing list
        var existingSubscribers = (this.subscribers[key] || []).map(function (_a) {
            var set = _a.set;
            return set;
        });
        // the list of new subscribers
        var newSubscribers = specs.filter(function (_a) {
            var set = _a.set;
            return !existingSubscribers.includes(set);
        });
        this.subscribers[key] = (_a = this.getSubscribers(key)).concat.apply(_a, __spread(newSubscribers));
        // if this is the first time we've seen this key
        if (!this.referenceCounts[key]) {
            this.referenceCounts[key] = new Map();
        }
        var counts = this.referenceCounts[key];
        try {
            // increment the reference count for every subscriber
            for (var specs_1 = __values(specs), specs_1_1 = specs_1.next(); !specs_1_1.done; specs_1_1 = specs_1.next()) {
                var spec = specs_1_1.value;
                // we're going to increment the current value by one
                counts.set(spec.set, (counts.get(spec.set) || 0) + 1);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (specs_1_1 && !specs_1_1.done && (_b = specs_1.return)) _b.call(specs_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };
    Record.prototype.getSubscribers = function (fieldName) {
        return this.subscribers[fieldName] || [];
    };
    Record.prototype.forgetSubscribers = function () {
        var targets = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            targets[_i] = arguments[_i];
        }
        this.forgetSubscribers_walk(targets.map(function (_a) {
            var set = _a.set;
            return set;
        }));
    };
    Record.prototype.removeAllSubscribers = function () {
        this.forgetSubscribers.apply(this, __spread(this.allSubscribers()));
    };
    Record.prototype.addConnectionReference = function (ref) {
        this.connections.push(ref);
    };
    Record.prototype.removeConnectionReference = function (ref) {
        this.connections = this.connections.filter(function (conn) { return !(conn.name === ref.name && conn.parentID === ref.parentID); });
    };
    Record.prototype.removeAllSubscriptionVerions = function (keyRaw, spec) {
        // visit every version of the key we've seen and remove the spec from the list of subscribers
        var versions = this.keyVersions[keyRaw];
        // if there are no known versons, we're done
        if (!versions) {
            return;
        }
        this.removeSubscribers(__spread(this.keyVersions[keyRaw]), [spec.set]);
    };
    Record.prototype.forgetSubscribers_walk = function (targets) {
        var e_2, _a;
        var _this = this;
        var _b;
        // clean up any subscribers that reference the set
        this.removeSubscribers(Object.keys(this.subscribers), targets);
        // walk down to every record we know about
        var linkedIDs = Object.keys(this.recordLinks).concat(Object.keys(this.listLinks).flatMap(function (key) { return _this.listLinks[key]; }));
        try {
            for (var linkedIDs_1 = __values(linkedIDs), linkedIDs_1_1 = linkedIDs_1.next(); !linkedIDs_1_1.done; linkedIDs_1_1 = linkedIDs_1.next()) {
                var linkedRecordID = linkedIDs_1_1.value;
                (_b = this.cache.internal.getRecord(linkedRecordID)) === null || _b === void 0 ? void 0 : _b.forgetSubscribers_walk(targets);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (linkedIDs_1_1 && !linkedIDs_1_1.done && (_a = linkedIDs_1.return)) _a.call(linkedIDs_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
    };
    Record.prototype.removeSubscribers = function (fields, sets) {
        var e_3, _a;
        var _b;
        var _loop_1 = function (fieldName) {
            var e_4, _a;
            // build up a list of the sets we actually need to remove after
            // checking reference counts
            var targets = [];
            try {
                for (var sets_1 = (e_4 = void 0, __values(sets)), sets_1_1 = sets_1.next(); !sets_1_1.done; sets_1_1 = sets_1.next()) {
                    var set = sets_1_1.value;
                    // if we dont know this field/set combo, there's nothing to do (probably a bug somewhere)
                    if (!((_b = this_1.referenceCounts[fieldName]) === null || _b === void 0 ? void 0 : _b.has(set))) {
                        continue;
                    }
                    var counts = this_1.referenceCounts[fieldName];
                    var newVal = (counts.get(set) || 0) - 1;
                    // decrement the reference of every field
                    counts.set(set, newVal);
                    // if that was the last reference we knew of
                    if (newVal <= 0) {
                        targets.push(set);
                        // remove the count too
                        counts.delete(set);
                    }
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (sets_1_1 && !sets_1_1.done && (_a = sets_1.return)) _a.call(sets_1);
                }
                finally { if (e_4) throw e_4.error; }
            }
            // we do need to remove the set from the list
            this_1.subscribers[fieldName] = this_1.getSubscribers(fieldName).filter(function (_a) {
                var set = _a.set;
                return !targets.includes(set);
            });
        };
        var this_1 = this;
        try {
            // clean up any subscribers that reference the set
            for (var fields_1 = __values(fields), fields_1_1 = fields_1.next(); !fields_1_1.done; fields_1_1 = fields_1.next()) {
                var fieldName = fields_1_1.value;
                _loop_1(fieldName);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (fields_1_1 && !fields_1_1.done && (_a = fields_1.return)) _a.call(fields_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
    };
    return Record;
}());
exports.Record = Record;
