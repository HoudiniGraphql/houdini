"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuery = void 0;
// externals
var store_1 = require("svelte/store");
var svelte_1 = require("svelte");
var cache_1 = __importDefault(require("./cache"));
var context_1 = require("./context");
function query(document) {
    // make sure we got a query document
    if (document.kind !== 'HoudiniQuery') {
        throw new Error('query() must be passed a query document');
    }
    var variables = document.variables;
    // embed the variables in the components context
    context_1.setVariables(function () { return variables; });
    // dry the reference to the initial value
    var initialValue = document.initialValue.data;
    // define the store we will hold the data
    var store = store_1.writable(initialValue);
    // pull out the writer for internal use
    var subscriptionSpec = {
        rootType: document.artifact.rootType,
        selection: document.artifact.selection,
        set: store.set,
    };
    // when the component mounts
    svelte_1.onMount(function () {
        // update the cache with the data that we just ran into
        cache_1.default.write(document.artifact.selection, initialValue, variables);
        // stay up to date
        if (subscriptionSpec) {
            cache_1.default.subscribe(subscriptionSpec, variables);
        }
    });
    // the function used to clean up the store
    svelte_1.onDestroy(function () {
        subscriptionSpec = null;
        cache_1.default.unsubscribe({
            rootType: document.artifact.rootType,
            selection: document.artifact.selection,
            set: store.set,
        }, variables);
    });
    return {
        // the store should be read-only from the caller's perspective
        data: { subscribe: store.subscribe },
        // used primarily by the preprocessor to keep local state in sync with
        // the data given by preload
        writeData: function (newData, newVariables) {
            variables = newVariables || {};
            // make sure we list to the new data
            if (subscriptionSpec) {
                cache_1.default.subscribe(subscriptionSpec, variables);
            }
            // write the data we received
            cache_1.default.write(document.artifact.selection, newData.data, variables);
        },
    };
}
exports.default = query;
// we need something we can replace the call to query that the user invokes
// it justs needs to pass through since we'll give it a reference to a hoisted query
var getQuery = function (arg) { return arg; };
exports.getQuery = getQuery;
