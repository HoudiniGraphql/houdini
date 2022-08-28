import { ProgramKind } from 'ast-types/gen/kinds'
import path from 'path'
import * as recast from 'recast'
import * as typeScriptParser from 'recast/parsers/typescript'
import { test, expect } from 'vitest'

import { readFile, testConfig } from '../../../common'
import { runPipeline } from '../../generate'

test('cache index runtime imports config file - commonjs', async function () {
	const config = testConfig({ module: 'commonjs' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await readFile(path.join(config.runtimeDirectory, 'cache', 'index.js'))

	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		"use strict";
		Object.defineProperty(exports, "__esModule", { value: true });
		const cache_1 = require("./cache");
		let cache;
		try {
		    // @ts-ignore: config will be defined by the generator
		    cache = new cache_1.Cache(config || {});
		}
		catch {
		    // @ts-ignore
		    cache = new cache_1.Cache({});
		}
		exports.default = cache;
	`)
})

test('cache index runtime imports config file - esm', async function () {
	const config = testConfig({ module: 'esm' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await readFile(path.join(config.runtimeDirectory, 'cache', 'index.js'))
	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import { Cache } from './cache';
		let cache;
		try {
		    // @ts-ignore: config will be defined by the generator
		    cache = new Cache(config || {});
		}
		catch {
		    // @ts-ignore
		    cache = new Cache({});
		}
		export default cache;
	`)
})

test('updates the network file with the client path', async function () {
	const config = testConfig({ module: 'esm' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await readFile(path.join(config.runtimeDirectory, 'lib', 'network.js'))
	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(parsedQuery).toMatchInlineSnapshot(`
		import { error, redirect } from '@sveltejs/kit';
		import { get } from 'svelte/store';
		import cache from '../cache';
		import * as log from './log';
		import { marshalInputs } from './scalars';
		import { CachePolicy, DataSource, } from './types';
		export class HoudiniClient {
		    constructor(networkFn, subscriptionHandler) {
		        this.fetchFn = networkFn;
		        this.socket = subscriptionHandler;
		    }
		    async sendRequest(ctx, params) {
		        let url = '';
		        // invoke the function
		        const result = await this.fetchFn({
		            // wrap the user's fetch function so we can identify SSR by checking
		            // the response.url
		            fetch: async (...args) => {
		                const response = await ctx.fetch(...args);
		                if (response.url) {
		                    url = response.url;
		                }
		                return response;
		            },
		            ...params,
		            metadata: ctx.metadata,
		        });
		        // return the result
		        return {
		            body: result,
		            ssr: !url,
		        };
		    }
		    init() { }
		}
		export class Environment extends HoudiniClient {
		    constructor(...args) {
		        super(...args);
		        log.info(\`\${log.red('⚠️  Environment has been renamed to HoudiniClient. ⚠️')}
		You should update your client to look something like the following:

		import { HoudiniClient } from '$houdini/runtime'

		export default new HoudiniClient(fetchQuery)


		For more information, please visit this link: https://www.houdinigraphql.com/guides/migrating-to-0.15.0#environment
		\`);
		    }
		}
		// This function is responsible for simulating the fetch context and executing the query with fetchQuery.
		// It is mainly used for mutations, refetch and possible other client side operations in the future.
		export async function executeQuery({ artifact, variables, cached, config, fetch, metadata, }) {
		    const { result: res, partial } = await fetchQuery({
		        context: {
		            fetch: fetch !== null && fetch !== void 0 ? fetch : globalThis.fetch.bind(globalThis),
		            metadata,
		        },
		        config,
		        artifact,
		        variables,
		        cached,
		    });
		    // we could have gotten a null response
		    if (res.errors && res.errors.length > 0) {
		        throw res.errors;
		    }
		    if (!res.data) {
		        throw new Error('Encountered empty data response in payload');
		    }
		    return { result: res, partial };
		}
		export async function getCurrentClient() {
		    // @ts-ignore
		    return (await import('../../../my/client/path')).default;
		}
		export async function fetchQuery({ artifact, variables, cached = true, policy, context, }) {
		    const client = await getCurrentClient();
		    // if there is no environment
		    if (!client) {
		        throw new Error('could not find houdini environment');
		    }
		    // enforce cache policies for queries
		    if (cached && artifact.kind === 'HoudiniQuery') {
		        // if the user didn't specify a policy, use the artifacts
		        if (!policy) {
		            policy = artifact.policy;
		        }
		        // this function is called as the first step in requesting data. If the policy prefers
		        // cached data, we need to load data from the cache (if its available). If the policy
		        // prefers network data we need to send a request (the onLoad of the component will
		        // resolve the next data)
		        // if the cache policy allows for cached data, look at the caches value first
		        if (policy !== CachePolicy.NetworkOnly) {
		            // look up the current value in the cache
		            const value = cache.read({ selection: artifact.selection, variables });
		            // if the result is partial and we dont allow it, dont return the value
		            const allowed = !value.partial || artifact.partial;
		            // if we have data, use that unless its partial data and we dont allow that
		            if (value.data !== null && allowed) {
		                return {
		                    result: {
		                        data: value.data,
		                        errors: [],
		                    },
		                    source: DataSource.Cache,
		                    partial: value.partial,
		                };
		            }
		            // if the policy is cacheOnly and we got this far, we need to return null (no network request will be sent)
		            else if (policy === CachePolicy.CacheOnly) {
		                return {
		                    result: {
		                        data: null,
		                        errors: [],
		                    },
		                    source: DataSource.Cache,
		                    partial: false,
		                };
		            }
		        }
		    }
		    // tick the garbage collector asynchronously
		    setTimeout(() => {
		        cache._internal_unstable.collectGarbage();
		    }, 0);
		    // the request must be resolved against the network
		    const result = await client.sendRequest(context, {
		        text: artifact.raw,
		        hash: artifact.hash,
		        variables,
		    });
		    return {
		        result: result.body,
		        source: result.ssr ? DataSource.Ssr : DataSource.Network,
		        partial: false,
		    };
		}
		export class RequestContext {
		    constructor(ctx) {
		        this.continue = true;
		        this.returnValue = {};
		        this.loadEvent = ctx;
		    }
		    error(status, message) {
		        throw error(status, typeof message === 'string' ? message : message.message);
		    }
		    redirect(status, location) {
		        throw redirect(status, location);
		    }
		    fetch(input, init) {
		        // make sure to bind the window object to the fetch in a browser
		        const fetch = typeof window !== 'undefined' ? this.loadEvent.fetch.bind(window) : this.loadEvent.fetch;
		        return fetch(input, init);
		    }
		    graphqlErrors(payload) {
		        // if we have a list of errors
		        if (payload.errors) {
		            return this.error(500, payload.errors.map(({ message }) => message).join('\\n'));
		        }
		        return this.error(500, 'Encountered invalid response: ' + JSON.stringify(payload));
		    }
		    // This hook fires before executing any queries, it allows custom props to be passed to the component.
		    async invokeLoadHook({ variant, hookFn, input, data, error, }) {
		        // call the onLoad function to match the framework
		        let hookCall;
		        if (variant === 'before') {
		            hookCall = hookFn.call(this, this.loadEvent);
		        }
		        else if (variant === 'after') {
		            // we have to assign input and data onto load so that we don't read values that
		            // are deprecated
		            hookCall = hookFn.call(this, {
		                event: this.loadEvent,
		                input,
		                data: Object.fromEntries(Object.entries(data).map(([key, store]) => [
		                    key,
		                    get(store).data,
		                ])),
		            });
		        }
		        else if (variant === 'error') {
		            hookCall = hookFn.call(this, {
		                event: this.loadEvent,
		                input,
		                error,
		            });
		        }
		        // make sure any promises are resolved
		        let result = await hookCall;
		        // If the returnValue is already set through this.error or this.redirect return early
		        if (!this.continue) {
		            return;
		        }
		        // If the result is null or undefined, or the result isn't an object return early
		        if (result == null || typeof result !== 'object') {
		            return;
		        }
		        this.returnValue = result;
		    }
		    // compute the inputs for an operation should reflect the framework's conventions.
		    async computeInput({ variableFunction, artifact, }) {
		        // call the variable function to match the framework
		        let input = await variableFunction.call(this, this.loadEvent);
		        return await marshalInputs({ artifact, input });
		    }
		}
	`)
})

test('updates the config file with import path', async function () {
	const config = testConfig({ module: 'esm' })
	// execute the generator
	await runPipeline(config, [])

	// open up the index file
	const fileContents = await readFile(path.join(config.runtimeDirectory, 'lib', 'config.js'))
	expect(fileContents).toBeTruthy()
	// parse the contents
	const parsedQuery: ProgramKind = recast.parse(fileContents!, {
		parser: typeScriptParser,
	}).program
	// verify contents
	expect(recast.print(parsedQuery).code).toContain("import('../../../config.cjs')")
})
