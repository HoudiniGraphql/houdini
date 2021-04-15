"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// externals
var store_1 = require("svelte/store");
var svelte_1 = require("svelte");
var cache_1 = __importDefault(require("./cache"));
var context_1 = require("./context");
// fragment returns the requested data from the reference
function fragment(fragment, initialValue) {
    // make sure we got a query document
    if (fragment.artifact.kind !== 'HoudiniFragment') {
        throw new Error('getFragment can only take fragment documents');
    }
    var subscriptionSpec;
    var queryVariables = context_1.getVariables();
    // wrap the result in a store we can use to keep this query up to date
    var value = store_1.readable(initialValue, function (set) {
        // @ts-ignore: isn't properly typed yet to know if initialValue has
        // what it needs to compute the id
        var parentID = cache_1.default.id(fragment.artifact.rootType, initialValue);
        subscriptionSpec = {
            rootType: fragment.artifact.rootType,
            selection: fragment.artifact.selection,
            set: set,
            parentID: parentID,
        };
        // when the component monuts
        svelte_1.onMount(function () {
            // if there is an id we can anchor the cache off of
            if (parentID && subscriptionSpec) {
                // stay up to date
                cache_1.default.subscribe(subscriptionSpec, queryVariables());
            }
        });
        // the function used to clean up the store
        return function () {
            // if we subscribed to something we'll need to clean up
            if (parentID) {
                cache_1.default.unsubscribe({
                    rootType: fragment.artifact.rootType,
                    parentID: parentID,
                    selection: fragment.artifact.selection,
                    set: set,
                }, queryVariables());
            }
        };
    });
    return value;
}
exports.default = fragment;
