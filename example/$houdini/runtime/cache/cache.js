import { Record } from './record';
import { ConnectionHandler } from './connection';
// this class implements the cache that drives houdini queries
export class Cache {
    constructor() {
        // the map from entity id to record
        this._data = new Map();
        // associate connection names with the handler that wraps the list
        this._connections = new Map();
        // we need to keep track of the variables used the last time a query was triggered
        this.lastKnownVariables = new Map();
    }
    // save the response in the local store and notify any subscribers
    write(selection, data, variables = {}, id) {
        const specs = [];
        const parentID = id || rootID;
        // recursively walk down the payload and update the store. calls to update atomic fields
        // will build up different specs of subscriptions that need to be run against the current state
        this._write(parentID, parentID, selection, parentID, data, variables, specs);
        // compute new values for every spec that needs to be run
        this.notifySubscribers(specs, variables);
    }
    id(type, data) {
        return type + ':' + (typeof data === 'string' ? data : this.computeID(data));
    }
    idFields(type) {
        return ['id'];
    }
    subscribe(spec, variables = {}) {
        // find the root record
        let rootRecord = spec.parentID ? this.record(spec.parentID) : this.root();
        if (!rootRecord) {
            throw new Error('Could not find root of subscription');
        }
        // walk down the selection and register any subscribers
        this.addSubscribers(rootRecord, spec, spec.selection, variables);
    }
    unsubscribe(spec, variables = {}) {
        // find the root record
        let rootRecord = spec.parentID ? this.getRecord(spec.parentID) : this.root();
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
    }
    // get the connection handler associated by name
    connection(name, id) {
        var _a;
        // make sure that the handler exists
        const handler = (_a = this._connections.get(name)) === null || _a === void 0 ? void 0 : _a.get(id || rootID);
        if (!handler) {
            throw new Error(`Cannot find connection with name: ${name} under parent: ${id}. ` +
                'Is it possible that the query is not mounted?');
        }
        // return the handler
        return handler;
    }
    // remove the record from every connection we know of and the cache itself
    delete(id, variables = {}) {
        const record = this.record(id);
        // remove any related subscriptions
        record.removeAllSubscribers();
        for (const { name, parentID } of record.connections) {
            // look up the connection
            const connection = this.connection(name, parentID);
            // remove the entity from the connection
            connection.removeID(id, variables);
        }
        // remove the entry from the cache
        return this._data.delete(id);
    }
    // grab the record specified by {id}.
    // note: this is hidden behind the adapter because it will make entries in the
    // cache that might not play by the correct garbage keeping rules. "advanved users only"
    record(id) {
        // if we haven't seen the record before add an entry in the store
        if (!this._data.has(id)) {
            this._data.set(id, new Record(this));
        }
        // write the field value
        return this._data.get(id);
    }
    get internal() {
        return {
            notifySubscribers: this.notifySubscribers.bind(this),
            insertSubscribers: this.insertSubscribers.bind(this),
            unsubscribeSelection: this.unsubscribeSelection.bind(this),
            evaluateKey: this.evaluateKey.bind(this),
            record: this.record.bind(this),
            getRecord: this.getRecord.bind(this),
        };
    }
    computeID(data) {
        return data.id;
    }
    root() {
        return this.record(rootID);
    }
    // walk down the spec
    getData(spec, parent, selection, variables) {
        const target = {};
        // look at every field in the parentFields
        for (const [attributeName, { type, keyRaw, fields }] of Object.entries(selection)) {
            const key = this.evaluateKey(keyRaw, variables);
            // if we are looking at a scalar
            if (this.isScalarLink(type)) {
                target[attributeName] = parent.getField(key);
                continue;
            }
            // if the link points to a record then we just have to add it to the one
            const linkedRecord = parent.linkedRecord(key);
            // if the field does point to a linked record
            if (linkedRecord && fields) {
                target[attributeName] = this.getData(spec, linkedRecord, fields, variables);
                continue;
            }
            // if the link points to a list
            const linkedList = parent.linkedList(key);
            if (linkedList && fields) {
                target[attributeName] = linkedList.map((linkedRecord) => this.getData(spec, linkedRecord, fields, variables));
            }
        }
        return target;
    }
    addSubscribers(rootRecord, spec, selection, variables) {
        var _a;
        for (const { type, keyRaw, fields, connection, filters } of Object.values(selection)) {
            const key = this.evaluateKey(keyRaw, variables);
            // we might be replace a subscriber on rootRecord becuase we have new variables
            // look at every version of the key and remove
            const oldVariables = this.lastKnownVariables.get(spec.set);
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
                const linkedRecord = rootRecord.linkedRecord(key);
                let children = linkedRecord ? [linkedRecord] : rootRecord.linkedList(key);
                // if this field is marked as a connection, register it
                if (connection && fields) {
                    // if we haven't seen this connection before
                    if (!this._connections.has(connection)) {
                        this._connections.set(connection, new Map());
                    }
                    // if we haven't already registered a handler to this connection in the cache
                    (_a = this._connections.get(connection)) === null || _a === void 0 ? void 0 : _a.set(spec.parentID || rootID, new ConnectionHandler({
                        name: connection,
                        parentID: spec.parentID,
                        cache: this,
                        record: rootRecord,
                        connectionType: type,
                        key,
                        selection: fields,
                        filters: Object.entries(filters || {}).reduce((acc, [key, { kind, value }]) => {
                            return {
                                ...acc,
                                [key]: kind !== 'Variable' ? value : variables[value],
                            };
                        }, {}),
                    }));
                }
                // if we're not related to anything, we're done
                if (!children || !fields) {
                    continue;
                }
                // add the subscriber to every child
                for (const child of children) {
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
        }
    }
    removeSubscribers(rootRecord, spec, selection, variables) {
        for (const { type, keyRaw, fields, connection } of Object.values(selection)) {
            // figure out the actual key
            const key = this.evaluateKey(keyRaw, variables);
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
                const linkedRecord = rootRecord.linkedRecord(key);
                let children = linkedRecord ? [linkedRecord] : rootRecord.linkedList(key);
                // if we still dont have anything to attach it to then there's no one to subscribe to
                if (!children || !fields) {
                    continue;
                }
                // remove the subscriber to every child
                for (const child of children) {
                    this.removeSubscribers(child, spec, fields, variables);
                }
            }
        }
    }
    _write(rootID, // the ID that anchors any connections
    parentID, // the ID that can be used to build up the key for embedded data
    selection, recordID, // the ID of the record that we are updating in cache
    data, variables, specs) {
        var _a, _b;
        // the record we are storing information about this object
        const record = this.record(recordID);
        // look at ever field in the data
        for (const [field, value] of Object.entries(data)) {
            if (!selection || !selection[field]) {
                throw new Error('Could not find field listing in selection for ' +
                    field +
                    ' @ ' +
                    JSON.stringify(selection) +
                    '');
            }
            // look up the field in our schema
            const { type: linkedType, keyRaw, fields, operations, connection } = selection[field];
            const key = this.evaluateKey(keyRaw, variables);
            // make sure we found the type info
            if (!linkedType) {
                throw new Error('could not find the field information for ' + field);
            }
            // the subscribers we need to register if we updated something
            const subscribers = record.getSubscribers(key);
            // if the value is an object, we know it points to a linked record
            if (value instanceof Object && !Array.isArray(value) && fields) {
                // look up the current known link id
                const oldID = record.linkedRecordID(key);
                // figure out if this is an embedded list or a linked one by looking for all of the fields marked as
                // required to compute the entity's id
                const embedded = ((_a = this.idFields(linkedType)) === null || _a === void 0 ? void 0 : _a.filter((field) => typeof value[field] === 'undefined').length) > 0;
                // figure out the id of the new linked record
                const linkedID = !embedded ? this.id(linkedType, value) : `${parentID}.${key}`;
                // if we are now linked to a new object we need to record the new value
                if (oldID !== linkedID) {
                    // record the updated value
                    record.writeRecordLink(key, linkedID);
                    // if there was a record we replaced
                    if (oldID) {
                        // we need to remove any subscribers that we just added to the specs
                        this.record(oldID).forgetSubscribers(...subscribers);
                    }
                    // add every subscriber to the list of specs to change
                    specs.push(...subscribers);
                }
                // update the linked fields too
                this._write(rootID, recordID, fields, linkedID, value, variables, specs);
            }
            // the value could be a list
            else if (!this.isScalarLink(linkedType) && Array.isArray(value) && fields) {
                // build up the list of linked ids
                const linkedIDs = [];
                // look up the current known link id
                const oldIDs = record.linkedListIDs(this.evaluateKey(key, variables));
                // the ids that have been added since the last time
                const newIDs = [];
                // figure out if this is an embedded list or a linked one by looking for all of the fields marked as
                // required to compute the entity's id in the first non-null value we can find
                const embedded = value.length > 0 &&
                    ((_b = this.idFields(linkedType)) === null || _b === void 0 ? void 0 : _b.filter((field) => typeof value.find((val) => val)[field] ===
                        'undefined').length) > 0;
                // visit every entry in the list
                for (const [i, entry] of value.entries()) {
                    // this has to be an object for sanity sake (it can't be a link if its a scalar)
                    if (!(entry instanceof Object) || Array.isArray(entry)) {
                        throw new Error('Encountered link to non objects');
                    }
                    // build up an
                    const linkedID = !embedded
                        ? this.id(linkedType, entry)
                        : `${parentID}.${key}[${i}]`;
                    // update the linked fields too
                    this._write(rootID, recordID, fields, linkedID, entry, variables, specs);
                    // add the id to the list
                    linkedIDs.push(linkedID);
                    // hold onto the new ids
                    if (!oldIDs.includes(linkedID)) {
                        newIDs.push(linkedID);
                        if (connection) {
                            this.record(linkedID).addConnectionReference({
                                parentID: rootID,
                                name: connection,
                            });
                        }
                    }
                }
                // we have to notify the subscribers if a few things happen:
                // either the data changed (ie we got new content for the same connection)
                // or we got content for a new connection which could already be known. If we just look at
                // wether the IDs are the same, situations where we have old data that
                // is still valid would not be triggered
                const contentChanged = JSON.stringify(linkedIDs) !== JSON.stringify(oldIDs);
                let oldSubscribers = {};
                // we need to look at the last time we saw each subscriber to check if they need to be added to the spec
                for (const subscriber of subscribers) {
                    const variablesChanged = JSON.stringify(this.lastKnownVariables.get(subscriber.set) || {}) !==
                        JSON.stringify(variables);
                    // if either are true, add the subscriber to the list
                    if (contentChanged || variablesChanged) {
                        specs.push(subscriber);
                    }
                    this.lastKnownVariables.set(subscriber.set, variables);
                }
                // remove any subscribers we dont can't about
                for (const lostID of oldIDs.filter((id) => !linkedIDs.includes(id))) {
                    for (const sub of subscribers) {
                        if (!oldSubscribers[lostID]) {
                            oldSubscribers[lostID] = new Set();
                        }
                        oldSubscribers[lostID].add(sub);
                    }
                }
                for (const [id, subscribers] of Object.entries(oldSubscribers)) {
                    this.record(id).forgetSubscribers(...subscribers);
                }
                // if there was a change in the list
                if (contentChanged) {
                    // update the cached value
                    record.writeListLink(key, linkedIDs);
                }
            }
            // the value is neither an object or a list so its a scalar
            else {
                // if the value is different
                if (value !== record.getField(key)) {
                    // update the cached value
                    record.writeField(key, value);
                    // add every subscriber to the list of specs to change
                    specs.push(...subscribers);
                }
            }
            // handle any operations relative to this node
            for (const operation of operations || []) {
                // turn the ID into something we can use
                let parentID;
                if (operation.parentID) {
                    // if its a normal scalar we can use the value directly
                    if (operation.parentID.kind !== 'Variable') {
                        parentID = operation.parentID.value;
                    }
                    else {
                        const value = variables[operation.parentID.value];
                        if (typeof value !== 'string') {
                            throw new Error('parentID value must be a string');
                        }
                        parentID = value;
                    }
                }
                // only insert an object into a connection if we're adding an object with fields
                if (operation.action === 'insert' &&
                    value instanceof Object &&
                    !Array.isArray(value) &&
                    fields &&
                    operation.connection) {
                    this.connection(operation.connection, parentID)
                        .when(operation.when)
                        .addToConnection(fields, value, variables, operation.position || 'last');
                }
                // only insert an object into a connection if we're adding an object with fields
                else if (operation.action === 'remove' &&
                    value instanceof Object &&
                    !Array.isArray(value) &&
                    fields &&
                    operation.connection) {
                    this.connection(operation.connection, parentID)
                        .when(operation.when)
                        .remove(value, variables);
                }
                // delete the operation if we have to
                else if (operation.action === 'delete' && operation.type) {
                    if (typeof value !== 'string') {
                        throw new Error('Cannot delete a record with a non-string ID');
                    }
                    this.delete(this.id(operation.type, value), variables);
                }
            }
        }
    }
    // look up the information for a specific record
    getRecord(id) {
        if (!id) {
            return null;
        }
        return this._data.get(id) || null;
    }
    isScalarLink(type) {
        return ['String', 'Boolean', 'Float', 'ID', 'Int'].includes(type);
    }
    notifySubscribers(specs, variables = {}) {
        for (const spec of specs) {
            // find the root record
            let rootRecord = spec.parentID ? this.getRecord(spec.parentID) : this.root();
            if (!rootRecord) {
                throw new Error('Could not find root of subscription');
            }
            // trigger the update
            spec.set(this.getData(spec, rootRecord, spec.selection, variables));
        }
    }
    insertSubscribers(record, selection, variables, ...subscribers) {
        // look at every field in the selection and add the subscribers
        for (const { keyRaw, fields } of Object.values(selection)) {
            const key = this.evaluateKey(keyRaw, variables);
            // add the subscriber to the
            record.addSubscriber(keyRaw, key, ...subscribers);
            // if there are fields under this
            if (fields) {
                const linkedRecord = record.linkedRecord(key);
                // figure out who else needs subscribers
                const children = linkedRecord ? [linkedRecord] : record.linkedList(key);
                for (const linkedRecord of children) {
                    this.insertSubscribers(linkedRecord, fields, variables, ...subscribers);
                }
            }
        }
    }
    unsubscribeSelection(record, selection, variables, ...subscribers) {
        // look at every field in the selection and add the subscribers
        for (const { keyRaw, fields } of Object.values(selection)) {
            const key = this.evaluateKey(keyRaw, variables);
            // add the subscriber to the
            record.removeSubscribers([key], subscribers);
            // if there are fields under this
            if (fields) {
                // figure out who else needs subscribers
                const children = record.linkedList(key) || [record.linkedRecord(key)];
                for (const linkedRecord of children) {
                    this.unsubscribeSelection(linkedRecord, fields, variables, ...subscribers);
                }
            }
        }
    }
    evaluateKey(key, variables = {}) {
        // accumulate the evaluated key
        let evaluated = '';
        // acumulate a variable name that we're evulating
        let varName = '';
        // some state to track if we are "in" a string
        let inString = false;
        for (const char of key) {
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
                const value = variables[varName.slice(1)];
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
        return evaluated;
    }
}
// the list of characters that make up a valid graphql variable name
const varChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789';
// id that we should use to refer to things in root
const rootID = '_ROOT_';
