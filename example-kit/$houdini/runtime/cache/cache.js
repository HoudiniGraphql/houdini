"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cache = void 0;
var record_1 = require("./record");
var connection_1 = require("./connection");
// this class implements the cache that drives houdini queries
var Cache = /** @class */ (function () {
    function Cache() {
        // the map from entity id to record
        this._data = new Map();
        // associate connection names with the handler that wraps the list
        this._connections = new Map();
        // we need to keep track of the variables used the last time a query was triggered
        this.lastKnownVariables = new Map();
    }
    // save the response in the local store and notify any subscribers
    Cache.prototype.write = function (selection, data, variables, id) {
        if (variables === void 0) { variables = {}; }
        var specs = [];
        var parentID = id || rootID;
        // recursively walk down the payload and update the store. calls to update atomic fields
        // will build up different specs of subscriptions that need to be run against the current state
        this._write(parentID, parentID, selection, parentID, data, variables, specs);
        // compute new values for every spec that needs to be run
        this.notifySubscribers(specs, variables);
    };
    Cache.prototype.id = function (type, data) {
        return type + ':' + (typeof data === 'string' ? data : this.computeID(data));
    };
    Cache.prototype.idFields = function (type) {
        return ['id'];
    };
    Cache.prototype.subscribe = function (spec, variables) {
        if (variables === void 0) { variables = {}; }
        // find the root record
        var rootRecord = spec.parentID ? this.record(spec.parentID) : this.root();
        if (!rootRecord) {
            throw new Error('Could not find root of subscription');
        }
        // walk down the selection and register any subscribers
        this.addSubscribers(rootRecord, spec, spec.selection, variables);
    };
    Cache.prototype.unsubscribe = function (spec, variables) {
        if (variables === void 0) { variables = {}; }
        // find the root record
        var rootRecord = spec.parentID ? this.getRecord(spec.parentID) : this.root();
        // if there's no root, there's nothing to unsubscribe from
        if (!rootRecord) {
            return;
        }
        // remove any references to the spec in variable set
        if (this.lastKnownVariables.has(spec.set)) {
            this.lastKnownVariables.delete(spec.set);
        }
        // walk down the selection and remove any subscribers from the list
        this.removeSubscribers(rootRecord, spec, spec.selection, variables);
    };
    // get the connection handler associated by name
    Cache.prototype.connection = function (name, id) {
        var _a;
        // make sure that the handler exists
        var handler = (_a = this._connections.get(name)) === null || _a === void 0 ? void 0 : _a.get(id || rootID);
        if (!handler) {
            throw new Error("Cannot find connection with name: " + name + " under parent: " + id + ". " +
                'Is it possible that the query is not mounted?');
        }
        // return the handler
        return handler;
    };
    // remove the record from every connection we know of and the cache itself
    Cache.prototype.delete = function (id, variables) {
        var e_1, _a;
        if (variables === void 0) { variables = {}; }
        var record = this.record(id);
        // remove any related subscriptions
        record.removeAllSubscribers();
        try {
            for (var _b = __values(record.connections), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = _c.value, name_1 = _d.name, parentID = _d.parentID;
                // look up the connection
                var connection = this.connection(name_1, parentID);
                // remove the entity from the connection
                connection.removeID(id, variables);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // remove the entry from the cache
        return this._data.delete(id);
    };
    // grab the record specified by {id}.
    // note: this is hidden behind the adapter because it will make entries in the
    // cache that might not play by the correct garbage keeping rules. "advanved users only"
    Cache.prototype.record = function (id) {
        // if we haven't seen the record before add an entry in the store
        if (!this._data.has(id)) {
            this._data.set(id, new record_1.Record(this));
        }
        // write the field value
        return this._data.get(id);
    };
    Object.defineProperty(Cache.prototype, "internal", {
        get: function () {
            return {
                notifySubscribers: this.notifySubscribers.bind(this),
                insertSubscribers: this.insertSubscribers.bind(this),
                unsubscribeSelection: this.unsubscribeSelection.bind(this),
                evaluateKey: this.evaluateKey.bind(this),
                record: this.record.bind(this),
                getRecord: this.getRecord.bind(this),
            };
        },
        enumerable: false,
        configurable: true
    });
    Cache.prototype.computeID = function (data) {
        return data.id;
    };
    Cache.prototype.root = function () {
        return this.record(rootID);
    };
    // walk down the spec
    Cache.prototype.getData = function (spec, parent, selection, variables) {
        var e_2, _a;
        var _this = this;
        var target = {};
        var _loop_1 = function (attributeName, type, keyRaw, fields) {
            var key = this_1.evaluateKey(keyRaw, variables);
            // if we are looking at a scalar
            if (this_1.isScalarLink(type)) {
                target[attributeName] = parent.getField(key);
                return "continue";
            }
            // if the link points to a record then we just have to add it to the one
            var linkedRecord = parent.linkedRecord(key);
            // if the field does point to a linked record
            if (linkedRecord && fields) {
                target[attributeName] = this_1.getData(spec, linkedRecord, fields, variables);
                return "continue";
            }
            // if the link points to a list
            var linkedList = parent.linkedList(key);
            if (linkedList && fields) {
                target[attributeName] = linkedList.map(function (linkedRecord) {
                    return _this.getData(spec, linkedRecord, fields, variables);
                });
            }
        };
        var this_1 = this;
        try {
            // look at every field in the parentFields
            for (var _b = __values(Object.entries(selection)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), attributeName = _d[0], _e = _d[1], type = _e.type, keyRaw = _e.keyRaw, fields = _e.fields;
                _loop_1(attributeName, type, keyRaw, fields);
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return target;
    };
    Cache.prototype.addSubscribers = function (rootRecord, spec, selection, variables) {
        var e_3, _a, e_4, _b;
        var _c;
        try {
            for (var _d = __values(Object.values(selection)), _e = _d.next(); !_e.done; _e = _d.next()) {
                var _f = _e.value, type = _f.type, keyRaw = _f.keyRaw, fields = _f.fields, connection = _f.connection, filters = _f.filters;
                var key = this.evaluateKey(keyRaw, variables);
                // we might be replace a subscriber on rootRecord becuase we have new variables
                // look at every version of the key and remove
                var oldVariables = this.lastKnownVariables.get(spec.set);
                if (keyRaw.includes('$') &&
                    JSON.stringify(variables) !== JSON.stringify(oldVariables)) {
                    rootRecord.removeAllSubscriptionVerions(keyRaw, spec);
                }
                // add the subscriber to the field
                rootRecord.addSubscriber(keyRaw, key, spec);
                // if the field points to a link, we need to subscribe to any fields of that
                // linked record
                if (!this.isScalarLink(type)) {
                    // if the link points to a record then we just have to add it to the one
                    var linkedRecord = rootRecord.linkedRecord(key);
                    var children = linkedRecord ? [linkedRecord] : rootRecord.linkedList(key);
                    // if this field is marked as a connection, register it
                    if (connection && fields) {
                        // if we haven't seen this connection before
                        if (!this._connections.has(connection)) {
                            this._connections.set(connection, new Map());
                        }
                        // if we haven't already registered a handler to this connection in the cache
                        (_c = this._connections.get(connection)) === null || _c === void 0 ? void 0 : _c.set(spec.parentID || rootID, new connection_1.ConnectionHandler({
                            name: connection,
                            parentID: spec.parentID,
                            cache: this,
                            record: rootRecord,
                            connectionType: type,
                            key: key,
                            selection: fields,
                            filters: Object.entries(filters || {}).reduce(function (acc, _a) {
                                var _b;
                                var _c = __read(_a, 2), key = _c[0], _d = _c[1], kind = _d.kind, value = _d.value;
                                return __assign(__assign({}, acc), (_b = {}, _b[key] = kind !== 'Variable' ? value : variables[value], _b));
                            }, {}),
                        }));
                    }
                    // if we're not related to anything, we're done
                    if (!children || !fields) {
                        continue;
                    }
                    try {
                        // add the subscriber to every child
                        for (var children_1 = (e_4 = void 0, __values(children)), children_1_1 = children_1.next(); !children_1_1.done; children_1_1 = children_1.next()) {
                            var child = children_1_1.value;
                            // the children of a connection need the reference back
                            if (connection) {
                                // add the connection reference to record
                                child.addConnectionReference({
                                    name: connection,
                                    parentID: spec.parentID,
                                });
                            }
                            // make sure the children update this subscription
                            this.addSubscribers(child, spec, fields, variables);
                        }
                    }
                    catch (e_4_1) { e_4 = { error: e_4_1 }; }
                    finally {
                        try {
                            if (children_1_1 && !children_1_1.done && (_b = children_1.return)) _b.call(children_1);
                        }
                        finally { if (e_4) throw e_4.error; }
                    }
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
            }
            finally { if (e_3) throw e_3.error; }
        }
    };
    Cache.prototype.removeSubscribers = function (rootRecord, spec, selection, variables) {
        var e_5, _a, e_6, _b;
        try {
            for (var _c = __values(Object.values(selection)), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = _d.value, type = _e.type, keyRaw = _e.keyRaw, fields = _e.fields, connection = _e.connection;
                // figure out the actual key
                var key = this.evaluateKey(keyRaw, variables);
                // remove the subscriber to the field
                rootRecord.forgetSubscribers(spec);
                // if this field is marked as a connection remove it from teh cache
                if (connection) {
                    this._connections.delete(connection);
                    rootRecord.removeConnectionReference({
                        name: connection,
                        parentID: spec.parentID,
                    });
                }
                // if the field points to a link, we need to remove any subscribers on any fields of that
                // linked record
                if (!this.isScalarLink(type)) {
                    // if the link points to a record then we just have to remove it to the one
                    var linkedRecord = rootRecord.linkedRecord(key);
                    var children = linkedRecord ? [linkedRecord] : rootRecord.linkedList(key);
                    // if we still dont have anything to attach it to then there's no one to subscribe to
                    if (!children || !fields) {
                        continue;
                    }
                    try {
                        // remove the subscriber to every child
                        for (var children_2 = (e_6 = void 0, __values(children)), children_2_1 = children_2.next(); !children_2_1.done; children_2_1 = children_2.next()) {
                            var child = children_2_1.value;
                            this.removeSubscribers(child, spec, fields, variables);
                        }
                    }
                    catch (e_6_1) { e_6 = { error: e_6_1 }; }
                    finally {
                        try {
                            if (children_2_1 && !children_2_1.done && (_b = children_2.return)) _b.call(children_2);
                        }
                        finally { if (e_6) throw e_6.error; }
                    }
                }
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_5) throw e_5.error; }
        }
    };
    Cache.prototype._write = function (rootID, // the ID that anchors any connections
    parentID, // the ID that can be used to build up the key for embedded data
    selection, recordID, // the ID of the record that we are updating in cache
    data, variables, specs) {
        var e_7, _a;
        var _b, _c;
        // the record we are storing information about this object
        var record = this.record(recordID);
        var _loop_2 = function (field, value) {
            var _a, e_8, _b, e_9, _c, e_10, _d, e_11, _e, e_12, _f, _g, e_13, _h;
            if (!selection || !selection[field]) {
                throw new Error('Could not find field listing in selection for ' +
                    field +
                    ' @ ' +
                    JSON.stringify(selection) +
                    '');
            }
            // look up the field in our schema
            var _j = selection[field], linkedType = _j.type, keyRaw = _j.keyRaw, fields = _j.fields, operations = _j.operations, connection = _j.connection;
            var key = this_2.evaluateKey(keyRaw, variables);
            // make sure we found the type info
            if (!linkedType) {
                throw new Error('could not find the field information for ' + field);
            }
            // the subscribers we need to register if we updated something
            var subscribers = record.getSubscribers(key);
            // if the value is an object, we know it points to a linked record
            if (value instanceof Object && !Array.isArray(value) && fields) {
                // look up the current known link id
                var oldID = record.linkedRecordID(key);
                // figure out if this is an embedded list or a linked one by looking for all of the fields marked as
                // required to compute the entity's id
                var embedded = ((_b = this_2.idFields(linkedType)) === null || _b === void 0 ? void 0 : _b.filter(function (field) { return typeof value[field] === 'undefined'; }).length) > 0;
                // figure out the id of the new linked record
                var linkedID = !embedded ? this_2.id(linkedType, value) : parentID + "." + key;
                // if we are now linked to a new object we need to record the new value
                if (oldID !== linkedID) {
                    // record the updated value
                    record.writeRecordLink(key, linkedID);
                    // if there was a record we replaced
                    if (oldID) {
                        // we need to remove any subscribers that we just added to the specs
                        (_a = this_2.record(oldID)).forgetSubscribers.apply(_a, __spread(subscribers));
                    }
                    // add every subscriber to the list of specs to change
                    specs.push.apply(specs, __spread(subscribers));
                }
                // update the linked fields too
                this_2._write(rootID, recordID, fields, linkedID, value, variables, specs);
            }
            // the value could be a list
            else if (!this_2.isScalarLink(linkedType) && Array.isArray(value) && fields) {
                // build up the list of linked ids
                var linkedIDs_1 = [];
                // look up the current known link id
                var oldIDs = record.linkedListIDs(this_2.evaluateKey(key, variables));
                // the ids that have been added since the last time
                var newIDs = [];
                // figure out if this is an embedded list or a linked one by looking for all of the fields marked as
                // required to compute the entity's id in the first non-null value we can find
                var embedded = value.length > 0 &&
                    ((_c = this_2.idFields(linkedType)) === null || _c === void 0 ? void 0 : _c.filter(function (field) {
                        return typeof value.find(function (val) { return val; })[field] ===
                            'undefined';
                    }).length) > 0;
                try {
                    // visit every entry in the list
                    for (var _k = (e_8 = void 0, __values(value.entries())), _l = _k.next(); !_l.done; _l = _k.next()) {
                        var _m = __read(_l.value, 2), i = _m[0], entry = _m[1];
                        // this has to be an object for sanity sake (it can't be a link if its a scalar)
                        if (!(entry instanceof Object) || Array.isArray(entry)) {
                            throw new Error('Encountered link to non objects');
                        }
                        // build up an
                        var linkedID = !embedded
                            ? this_2.id(linkedType, entry)
                            : parentID + "." + key + "[" + i + "]";
                        // update the linked fields too
                        this_2._write(rootID, recordID, fields, linkedID, entry, variables, specs);
                        // add the id to the list
                        linkedIDs_1.push(linkedID);
                        // hold onto the new ids
                        if (!oldIDs.includes(linkedID)) {
                            newIDs.push(linkedID);
                            if (connection) {
                                this_2.record(linkedID).addConnectionReference({
                                    parentID: rootID,
                                    name: connection,
                                });
                            }
                        }
                    }
                }
                catch (e_8_1) { e_8 = { error: e_8_1 }; }
                finally {
                    try {
                        if (_l && !_l.done && (_b = _k.return)) _b.call(_k);
                    }
                    finally { if (e_8) throw e_8.error; }
                }
                // we have to notify the subscribers if a few things happen:
                // either the data changed (ie we got new content for the same connection)
                // or we got content for a new connection which could already be known. If we just look at
                // wether the IDs are the same, situations where we have old data that
                // is still valid would not be triggered
                var contentChanged = JSON.stringify(linkedIDs_1) !== JSON.stringify(oldIDs);
                var oldSubscribers = {};
                try {
                    // we need to look at the last time we saw each subscriber to check if they need to be added to the spec
                    for (var subscribers_1 = (e_9 = void 0, __values(subscribers)), subscribers_1_1 = subscribers_1.next(); !subscribers_1_1.done; subscribers_1_1 = subscribers_1.next()) {
                        var subscriber = subscribers_1_1.value;
                        var variablesChanged = JSON.stringify(this_2.lastKnownVariables.get(subscriber.set) || {}) !==
                            JSON.stringify(variables);
                        // if either are true, add the subscriber to the list
                        if (contentChanged || variablesChanged) {
                            specs.push(subscriber);
                        }
                        this_2.lastKnownVariables.set(subscriber.set, variables);
                    }
                }
                catch (e_9_1) { e_9 = { error: e_9_1 }; }
                finally {
                    try {
                        if (subscribers_1_1 && !subscribers_1_1.done && (_c = subscribers_1.return)) _c.call(subscribers_1);
                    }
                    finally { if (e_9) throw e_9.error; }
                }
                try {
                    // remove any subscribers we dont can't about
                    for (var _o = (e_10 = void 0, __values(oldIDs.filter(function (id) { return !linkedIDs_1.includes(id); }))), _p = _o.next(); !_p.done; _p = _o.next()) {
                        var lostID = _p.value;
                        try {
                            for (var subscribers_2 = (e_11 = void 0, __values(subscribers)), subscribers_2_1 = subscribers_2.next(); !subscribers_2_1.done; subscribers_2_1 = subscribers_2.next()) {
                                var sub = subscribers_2_1.value;
                                if (!oldSubscribers[lostID]) {
                                    oldSubscribers[lostID] = new Set();
                                }
                                oldSubscribers[lostID].add(sub);
                            }
                        }
                        catch (e_11_1) { e_11 = { error: e_11_1 }; }
                        finally {
                            try {
                                if (subscribers_2_1 && !subscribers_2_1.done && (_e = subscribers_2.return)) _e.call(subscribers_2);
                            }
                            finally { if (e_11) throw e_11.error; }
                        }
                    }
                }
                catch (e_10_1) { e_10 = { error: e_10_1 }; }
                finally {
                    try {
                        if (_p && !_p.done && (_d = _o.return)) _d.call(_o);
                    }
                    finally { if (e_10) throw e_10.error; }
                }
                try {
                    for (var _q = (e_12 = void 0, __values(Object.entries(oldSubscribers))), _r = _q.next(); !_r.done; _r = _q.next()) {
                        var _s = __read(_r.value, 2), id = _s[0], subscribers_3 = _s[1];
                        (_g = this_2.record(id)).forgetSubscribers.apply(_g, __spread(subscribers_3));
                    }
                }
                catch (e_12_1) { e_12 = { error: e_12_1 }; }
                finally {
                    try {
                        if (_r && !_r.done && (_f = _q.return)) _f.call(_q);
                    }
                    finally { if (e_12) throw e_12.error; }
                }
                // if there was a change in the list
                if (contentChanged) {
                    // update the cached value
                    record.writeListLink(key, linkedIDs_1);
                }
            }
            // the value is neither an object or a list so its a scalar
            else {
                // if the value is different
                if (value !== record.getField(key)) {
                    // update the cached value
                    record.writeField(key, value);
                    // add every subscriber to the list of specs to change
                    specs.push.apply(specs, __spread(subscribers));
                }
            }
            try {
                // handle any operations relative to this node
                for (var _t = (e_13 = void 0, __values(operations || [])), _u = _t.next(); !_u.done; _u = _t.next()) {
                    var operation = _u.value;
                    // turn the ID into something we can use
                    var parentID_1 = void 0;
                    if (operation.parentID) {
                        // if its a normal scalar we can use the value directly
                        if (operation.parentID.kind !== 'Variable') {
                            parentID_1 = operation.parentID.value;
                        }
                        else {
                            var value_1 = variables[operation.parentID.value];
                            if (typeof value_1 !== 'string') {
                                throw new Error('parentID value must be a string');
                            }
                            parentID_1 = value_1;
                        }
                    }
                    // only insert an object into a connection if we're adding an object with fields
                    if (operation.action === 'insert' &&
                        value instanceof Object &&
                        !Array.isArray(value) &&
                        fields &&
                        operation.connection) {
                        this_2.connection(operation.connection, parentID_1)
                            .when(operation.when)
                            .addToConnection(fields, value, variables, operation.position || 'last');
                    }
                    // only insert an object into a connection if we're adding an object with fields
                    else if (operation.action === 'remove' &&
                        value instanceof Object &&
                        !Array.isArray(value) &&
                        fields &&
                        operation.connection) {
                        this_2.connection(operation.connection, parentID_1)
                            .when(operation.when)
                            .remove(value, variables);
                    }
                    // delete the operation if we have to
                    else if (operation.action === 'delete' && operation.type) {
                        if (typeof value !== 'string') {
                            throw new Error('Cannot delete a record with a non-string ID');
                        }
                        this_2.delete(this_2.id(operation.type, value), variables);
                    }
                }
            }
            catch (e_13_1) { e_13 = { error: e_13_1 }; }
            finally {
                try {
                    if (_u && !_u.done && (_h = _t.return)) _h.call(_t);
                }
                finally { if (e_13) throw e_13.error; }
            }
        };
        var this_2 = this;
        try {
            // look at ever field in the data
            for (var _d = __values(Object.entries(data)), _e = _d.next(); !_e.done; _e = _d.next()) {
                var _f = __read(_e.value, 2), field = _f[0], value = _f[1];
                _loop_2(field, value);
            }
        }
        catch (e_7_1) { e_7 = { error: e_7_1 }; }
        finally {
            try {
                if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
            }
            finally { if (e_7) throw e_7.error; }
        }
    };
    // look up the information for a specific record
    Cache.prototype.getRecord = function (id) {
        if (!id) {
            return null;
        }
        return this._data.get(id) || null;
    };
    Cache.prototype.isScalarLink = function (type) {
        return ['String', 'Boolean', 'Float', 'ID', 'Int'].includes(type);
    };
    Cache.prototype.notifySubscribers = function (specs, variables) {
        var e_14, _a;
        if (variables === void 0) { variables = {}; }
        try {
            for (var specs_1 = __values(specs), specs_1_1 = specs_1.next(); !specs_1_1.done; specs_1_1 = specs_1.next()) {
                var spec = specs_1_1.value;
                // find the root record
                var rootRecord = spec.parentID ? this.getRecord(spec.parentID) : this.root();
                if (!rootRecord) {
                    throw new Error('Could not find root of subscription');
                }
                // trigger the update
                spec.set(this.getData(spec, rootRecord, spec.selection, variables));
            }
        }
        catch (e_14_1) { e_14 = { error: e_14_1 }; }
        finally {
            try {
                if (specs_1_1 && !specs_1_1.done && (_a = specs_1.return)) _a.call(specs_1);
            }
            finally { if (e_14) throw e_14.error; }
        }
    };
    Cache.prototype.insertSubscribers = function (record, selection, variables) {
        var e_15, _a, e_16, _b;
        var subscribers = [];
        for (var _i = 3; _i < arguments.length; _i++) {
            subscribers[_i - 3] = arguments[_i];
        }
        try {
            // look at every field in the selection and add the subscribers
            for (var _c = __values(Object.values(selection)), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = _d.value, keyRaw = _e.keyRaw, fields = _e.fields;
                var key = this.evaluateKey(keyRaw, variables);
                // add the subscriber to the
                record.addSubscriber.apply(record, __spread([keyRaw, key], subscribers));
                // if there are fields under this
                if (fields) {
                    var linkedRecord = record.linkedRecord(key);
                    // figure out who else needs subscribers
                    var children = linkedRecord ? [linkedRecord] : record.linkedList(key);
                    try {
                        for (var children_3 = (e_16 = void 0, __values(children)), children_3_1 = children_3.next(); !children_3_1.done; children_3_1 = children_3.next()) {
                            var linkedRecord_1 = children_3_1.value;
                            this.insertSubscribers.apply(this, __spread([linkedRecord_1, fields, variables], subscribers));
                        }
                    }
                    catch (e_16_1) { e_16 = { error: e_16_1 }; }
                    finally {
                        try {
                            if (children_3_1 && !children_3_1.done && (_b = children_3.return)) _b.call(children_3);
                        }
                        finally { if (e_16) throw e_16.error; }
                    }
                }
            }
        }
        catch (e_15_1) { e_15 = { error: e_15_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_15) throw e_15.error; }
        }
    };
    Cache.prototype.unsubscribeSelection = function (record, selection, variables) {
        var e_17, _a, e_18, _b;
        var subscribers = [];
        for (var _i = 3; _i < arguments.length; _i++) {
            subscribers[_i - 3] = arguments[_i];
        }
        try {
            // look at every field in the selection and add the subscribers
            for (var _c = __values(Object.values(selection)), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = _d.value, keyRaw = _e.keyRaw, fields = _e.fields;
                var key = this.evaluateKey(keyRaw, variables);
                // add the subscriber to the
                record.removeSubscribers([key], subscribers);
                // if there are fields under this
                if (fields) {
                    // figure out who else needs subscribers
                    var children = record.linkedList(key) || [record.linkedRecord(key)];
                    try {
                        for (var children_4 = (e_18 = void 0, __values(children)), children_4_1 = children_4.next(); !children_4_1.done; children_4_1 = children_4.next()) {
                            var linkedRecord = children_4_1.value;
                            this.unsubscribeSelection.apply(this, __spread([linkedRecord, fields, variables], subscribers));
                        }
                    }
                    catch (e_18_1) { e_18 = { error: e_18_1 }; }
                    finally {
                        try {
                            if (children_4_1 && !children_4_1.done && (_b = children_4.return)) _b.call(children_4);
                        }
                        finally { if (e_18) throw e_18.error; }
                    }
                }
            }
        }
        catch (e_17_1) { e_17 = { error: e_17_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_17) throw e_17.error; }
        }
    };
    Cache.prototype.evaluateKey = function (key, variables) {
        var e_19, _a;
        if (variables === void 0) { variables = {}; }
        // accumulate the evaluated key
        var evaluated = '';
        // acumulate a variable name that we're evulating
        var varName = '';
        // some state to track if we are "in" a string
        var inString = false;
        try {
            for (var key_1 = __values(key), key_1_1 = key_1.next(); !key_1_1.done; key_1_1 = key_1.next()) {
                var char = key_1_1.value;
                // if we are building up a variable
                if (varName) {
                    // if we are looking at a valid variable character
                    if (varChars.includes(char)) {
                        // add it to the variable name
                        varName += char;
                        continue;
                    }
                    // we are at the end of a variable name so we
                    // need to clean up and add before continuing with the string
                    // look up the variable and add the result (varName starts with a $)
                    var value = variables[varName.slice(1)];
                    evaluated += typeof value !== 'undefined' ? JSON.stringify(value) : 'undefined';
                    // clear the variable name accumulator
                    varName = '';
                }
                // if we are looking at the start of a variable
                if (char === '$' && !inString) {
                    // start the acumulator
                    varName = '$';
                    // move along
                    continue;
                }
                // if we found a quote, invert the string state
                if (char === '"') {
                    inString = !inString;
                }
                // this isn't a special case, just add the letter to the value
                evaluated += char;
            }
        }
        catch (e_19_1) { e_19 = { error: e_19_1 }; }
        finally {
            try {
                if (key_1_1 && !key_1_1.done && (_a = key_1.return)) _a.call(key_1);
            }
            finally { if (e_19) throw e_19.error; }
        }
        return evaluated;
    };
    return Cache;
}());
exports.Cache = Cache;
// the list of characters that make up a valid graphql variable name
var varChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789';
// id that we should use to refer to things in root
var rootID = '_ROOT_';
