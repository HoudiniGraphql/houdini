// externals
import { writable } from 'svelte/store';
import { onDestroy, onMount } from 'svelte';
import cache from './cache';
import { setVariables } from './context';
export default function query(document) {
    // make sure we got a query document
    if (document.kind !== 'HoudiniQuery') {
        throw new Error('query() must be passed a query document');
    }
    let variables = document.variables;
    // embed the variables in the components context
    setVariables(() => variables);
    // dry the reference to the initial value
    const initialValue = document.initialValue.data;
    // define the store we will hold the data
    const store = writable(initialValue);
    // pull out the writer for internal use
    let subscriptionSpec = {
        rootType: document.artifact.rootType,
        selection: document.artifact.selection,
        set: store.set,
    };
    // when the component mounts
    onMount(() => {
        // update the cache with the data that we just ran into
        cache.write(document.artifact.selection, initialValue, variables);
        // stay up to date
        if (subscriptionSpec) {
            cache.subscribe(subscriptionSpec, variables);
        }
    });
    // the function used to clean up the store
    onDestroy(() => {
        subscriptionSpec = null;
        cache.unsubscribe({
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
        writeData(newData, newVariables) {
            variables = newVariables || {};
            // make sure we list to the new data
            if (subscriptionSpec) {
                cache.subscribe(subscriptionSpec, variables);
            }
            // write the data we received
            cache.write(document.artifact.selection, newData.data, variables);
        },
    };
}
// we need something we can replace the call to query that the user invokes
// it justs needs to pass through since we'll give it a reference to a hoisted query
export const getQuery = (arg) => arg;
