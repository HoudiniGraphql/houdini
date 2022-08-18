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
		var config = require('../../../config.cjs');
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
		import config from "../../../config.cjs"
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
		import { isPrerender } from '../adapter';
		import cache from '../cache';
		import * as log from './log';
		import { marshalInputs } from './scalars';
		import { CachePolicy, DataSource, } from './types';
		export class HoudiniClient {
		    constructor(networkFn, subscriptionHandler) {
		        this.fetchFn = networkFn;
		        this.socket = subscriptionHandler;
		    }
		    async sendRequest(ctx, params, session) {
		        let url = '';
		        // wrap the user's fetch function so we can identify SSR by checking
		        // the response.url
		        const wrapper = async (...args) => {
		            const response = await ctx.fetch(...args);
		            if (response.url) {
		                url = response.url;
		            }
		            return response;
		        };
		        // invoke the function
		        const result = await this.fetchFn.call({
		            ...ctx,
		            get fetch() {
		                log.info(\`\${log.red("⚠️ fetch and session are now passed as arguments to your client's network function ⚠️")}
		You should update your client to look something like the following:

		async function fetchQuery({
			\${log.yellow('fetch')},
			text = '',
			variables = {},
			\${log.yellow('session')},
			metadata,
		}: RequestHandlerArgs) {
			const result =  await fetch( ... );

			return await result.json();
		}
		\`);
		                return wrapper;
		            },
		        }, {
		            fetch: wrapper,
		            ...params,
		            get session() {
		                // using session while prerendering is not meaningful
		                if (isPrerender) {
		                    throw new Error('Attempted to access session from a prerendered page. Session would never be populated.');
		                }
		                return session;
		            },
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
		// This function is responsible for simulating the fetch context, getting the current session and executing the fetchQuery.
		// It is mainly used for mutations, refetch and possible other client side operations in the future.
		export async function executeQuery({ artifact, variables, session, cached, config, metadata, fetch, }) {
		    // Simulate the fetch/load context
		    const fetchCtx = {
		        fetch: fetch !== null && fetch !== void 0 ? fetch : window.fetch.bind(window),
		        session,
		        stuff: {},
		        page: {
		            host: '',
		            path: '',
		            params: {},
		            query: new URLSearchParams(),
		        },
		    };
		    const { result: res, partial } = await fetchQuery({
		        context: { ...fetchCtx, metadata },
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
		export async function fetchQuery({ context, artifact, variables, cached = true, policy, }) {
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
		    const result = await client.sendRequest(context, { text: artifact.raw, hash: artifact.hash, variables }, context.session);
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
		    // This hook fires before executing any queries, it allows to redirect/error based on session state for example
		    // It also allows to return custom props that should be returned from the corresponding load function.
		    async invokeLoadHook({ variant, hookFn, input, data, }) {
		        // call the onLoad function to match the framework
		        let hookCall;
		        if (variant === 'before') {
		            hookCall = hookFn.call(this, this.loadEvent);
		        }
		        else {
		            hookCall = hookFn.call(this, {
		                ...this.loadEvent,
		                input,
		                data,
		            });
		        }
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
		    computeInput({ config, variableFunction, artifact, }) {
		        // call the variable function to match the framework
		        let input = variableFunction.call(this, this.loadEvent);
		        // and pass page and session
		        return marshalInputs({ artifact, config, input });
		    }
		}
		export async function loadAll(...loads) {
		    // we need to collect all of the promises in a single list that we will await in promise.all and then build up
		    const promises = [];
		    // the question we have to answer is wether entry is a promise or an object of promises
		    const isPromise = (val) => 'then' in val && 'finally' in val && 'catch' in val;
		    for (const entry of loads) {
		        if (!isPromise(entry) && 'then' in entry) {
		            throw new Error('❌ \`then\` is not a valid key for an object passed to loadAll');
		        }
		        // identify an entry with the \`.then\` method
		        if (isPromise(entry)) {
		            promises.push(entry);
		        }
		        else {
		            for (const [key, value] of Object.entries(entry)) {
		                if (isPromise(value)) {
		                    promises.push(value);
		                }
		                else {
		                    throw new Error(\`❌ \${key} is not a valid value for an object passed to loadAll. You must pass the result of a load_Store function\`);
		                }
		            }
		        }
		    }
		    // now that we've collected all of the promises, wait for them
		    await Promise.all(promises);
		    // all of the promises are resolved so go back over the value we were given a reconstruct it
		    let result = {};
		    for (const entry of loads) {
		        // if we're looking at a promise, it will contain the key
		        if (isPromise(entry)) {
		            Object.assign(result, await entry);
		        }
		        else {
		            Object.assign(result, 
		            // await every value in the object and assign it to result
		            Object.fromEntries(await Promise.all(Object.entries(entry).map(async ([key, value]) => [key, await value]))));
		        }
		    }
		    // we're done
		    return result;
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
	expect(parsedQuery).toMatchInlineSnapshot(`
		export function defaultConfigValues(file) {
		    return {
		        defaultKeys: ['id'],
		        ...file,
		        types: {
		            Node: {
		                keys: ['id'],
		                resolve: {
		                    queryField: 'node',
		                    arguments: (node) => ({ id: node.id }),
		                },
		            },
		            ...file.types,
		        },
		    };
		}
		export function keyFieldsForType(configFile, type) {
		    var _a, _b;
		    return ((_b = (_a = configFile.types) === null || _a === void 0 ? void 0 : _a[type]) === null || _b === void 0 ? void 0 : _b.keys) || configFile.defaultKeys;
		}
		export function computeID(configFile, type, data) {
		    const fields = keyFieldsForType(configFile, type);
		    let id = '';
		    for (const field of fields) {
		        id += data[field] + '__';
		    }
		    return id.slice(0, -2);
		}
		export async function getCurrentConfig() {
		    // @ts-ignore
		    return defaultConfigValues((await import('../../../config.cjs')).default);
		}
	`)
})
