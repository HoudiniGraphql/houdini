"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// externals
var store_1 = require("svelte/store");
var svelte_1 = require("svelte");
var network_1 = require("./network");
var cache_1 = __importDefault(require("./cache"));
// subscription holds open a live connection to the server. it returns a store
// containing the requested data. Houdini will also update the cache with any
// information that it encounters in the response.
function subscription(document, variables) {
    // make sure we got a query document
    if (document.kind !== 'HoudiniSubscription') {
        throw new Error('subscription() must be passed a subscription document');
    }
    // pull out the current environment
    var env = network_1.getEnvironment();
    // if there isn't one, yell loudly
    if (!env) {
        throw new Error('Could not find network environment');
    }
    // pull the query text out of the compiled artifact
    var _a = document.artifact, text = _a.raw, selection = _a.selection;
    // the primary function of a subscription is to keep the cache
    // up to date with the response
    // we need a place to hold the results that the client can use
    var store = store_1.writable(null);
    // the function to call that unregisters the subscription
    var unsubscribe;
    // the websocket connection only exists on the client
    svelte_1.onMount(function () {
        // we need to make sure that the user provided a socket connection
        if (!env.socket) {
            throw new Error('The current environment is not configured to handle subscriptions. Make sure you ' +
                'passed a client to its constructor.');
        }
        // start listening for updates from the server
        unsubscribe = env.socket.subscribe({ query: text, variables: variables }, {
            next: function (_a) {
                var data = _a.data, errors = _a.errors;
                // make sure there were no errors
                if (errors) {
                    throw errors;
                }
                // if we got a result
                if (data) {
                    // update the cache with the result
                    cache_1.default.write(selection, data, variables);
                    // update the local store
                    store.set(data);
                }
            },
            error: function (data) { },
            complete: function () { },
        });
    });
    svelte_1.onDestroy(function () {
        // if we have a subscription going
        if (unsubscribe) {
            unsubscribe();
        }
    });
    return { data: { subscribe: store.subscribe } };
}
exports.default = subscription;
