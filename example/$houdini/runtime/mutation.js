// locals
import { fetchQuery } from './network';
import cache from './cache';
import { getVariables } from './context';
// @ts-ignore: this file will get generated and does not exist in the source code
import { getSession } from './adapter.mjs';
// mutation returns a handler that will send the mutation to the server when
// invoked
export default function mutation(document) {
    // make sure we got a query document
    if (document.kind !== 'HoudiniMutation') {
        throw new Error('mutation() must be passed a mutation document');
    }
    // pull the query text out of the compiled artifact
    const { raw: text } = document.artifact;
    // grab the sesion from the adapter
    const session = getSession();
    const queryVariables = getVariables();
    // return an async function that sends the mutation go the server
    return (variables) => 
    // we want the mutation to throw an error if the network layer invokes this.error
    new Promise(async (resolve, reject) => {
        let result;
        // since we have a promise that's wrapping async/await we need a giant try/catch that will
        // reject the promise
        try {
            // we need to define a fetch context that plays well on the client without
            // access to this.fetch (mutations can't get access to preload)
            const mutationCtx = {
                fetch: window.fetch.bind(window),
                session,
                context: {},
                page: {
                    host: '',
                    path: '',
                    params: {},
                    query: new URLSearchParams(),
                },
            };
            // grab the response from the server
            const { data, errors } = await fetchQuery(mutationCtx, { text, variables }, session);
            // we could have gotten a null response
            if (errors) {
                reject(errors);
                return;
            }
            if (!data) {
                reject([new Error('Encountered empty data response in mutation payload')]);
                return;
            }
            result = data;
        }
        catch (e) {
            reject(e);
            return;
        }
        // update the cache with the mutation data
        cache.write(document.artifact.selection, result, queryVariables());
        // wrap the result in a store we can use to keep this query up to date
        resolve(result);
    });
}
