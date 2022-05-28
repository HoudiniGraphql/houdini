// external imports
import path from 'path'
import fs from 'fs/promises'
import * as typeScriptParser from 'recast/parsers/typescript'
import { ProgramKind } from 'ast-types/gen/kinds'
import * as recast from 'recast'
// local imports
import { testConfig } from '../../../common'
import '../../../../jest.setup'
import { runPipeline } from '../../generate'
import { CollectedGraphQLDocument } from '../../types'
import { mockCollectedDoc } from '../../testUtils'
import { readFile } from 'fs/promises'

// the config to use in tests
const config = testConfig()

test('generates a store for every query', async function () {
	// the documents to test
	const docs: CollectedGraphQLDocument[] = [
		mockCollectedDoc(`query TestQuery1 { version }`),
		mockCollectedDoc(`query TestQuery2 { version }`),
	]

	// execute the generator
	await runPipeline(config, docs)

	// look up the files in the artifact directory
	const files = await fs.readdir(config.storesDirectory)

	// and they have the right names
	expect(files).toEqual(expect.arrayContaining(['GQL_TestQuery1.js', 'GQL_TestQuery2.js']))
	// and type definitions exist
	expect(files).toEqual(expect.arrayContaining(['GQL_TestQuery1.d.ts', 'GQL_TestQuery2.d.ts']))
})

test('basic store', async function () {
	const docs = [mockCollectedDoc(`query TestQuery { version }`)]

	// run the generator
	await runPipeline(config, docs)

	const contents = await readFile(
		path.join(config.storesDirectory, config.storeName({ name: 'TestQuery' }) + '.js'),
		'utf-8'
	)

	// parse the contents
	const parsed = recast.parse(contents, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
					import { houdiniConfig } from '$houdini'
					import { stry } from '@kitql/helper'
					import { writable } from 'svelte/store'
					import { TestQuery as artifact } from '../artifacts'
					import { CachePolicy, DataSource, fetchQuery, RequestContext } from '../runtime'
					import { getSession, isBrowser } from '../runtime/adapter.mjs'
					import cache from '../runtime/cache'
					import { marshalInputs, unmarshalSelection } from '../runtime/scalars'

					// optional pagination imports 


					// TODO:
					// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!
					// - [ ] context client side (getPage, getSession) => GetStores issue

					function GQL_TestQueryStore() {
					    const { subscribe, set, update } = writable({
					        partial: false,
					        result: null,
					        source: null,
					        isFetching: false,
					    })

					    // Track subscriptions
					    let subscriptionSpec = null

					    // Current variables tracker
					    let variables = {}

					    
					    async function queryLoad(ctx, params) {
					        const context = new RequestContext(ctx)
					        return await queryLocal(context, params)
					    }
					    
					    async function query(params) {
					        // const sessionStore = getSession()
					        
					        const context = new RequestContext({
					            //page: getPage(),
					            fetch: fetch,
					            //session: getSession(),
					        })

					        return await queryLocal(context, params)
					    }

					    async function queryLocal(context, params) {
					        update((c) => {
					            return { ...c, isFetching: true }
					        })

					        // params management
					        params = params ?? {}
					       
					        // If no policy specified => artifact.policy, if there is nothing go to CacheOrNetwork
					        if (!params.policy) {
					            params.policy = artifact.policy ?? CachePolicy.CacheOrNetwork
					        }

					        const newVariables = marshalInputs({
					            artifact,
					            config: houdiniConfig,
					            input: params.variables,
					        })

					        let toReturn = await fetchQuery({
					            context,
					            artifact,
					            variables: newVariables,
					            session: context.session,
					            cached: params.policy !== CachePolicy.NetworkOnly,
					        })

					        // setup a subscription for new values from the cache
					        if (isBrowser) {
					            
					            subscriptionSpec = {
					                rootType: artifact.rootType,
					                selection: artifact.selection,
					                variables: () => newVariables,
					                set: set,
					            }
					            cache.subscribe(subscriptionSpec, variables)

					            const updated = stry(variables, 0) !== stry(newVariables, 0)

					            // if the variables changed we need to unsubscribe from the old fields and
					            // listen to the new ones
					            if (updated && subscriptionSpec) {
					                cache.unsubscribe(subscriptionSpec, variables)
					            }

					            // if the data was loaded from a cached value, and the document cache policy wants a
					            // network request to be sent after the data was loaded, load the data
					            if (
					                toReturn.source === DataSource.Cache &&
					                params.policy === CachePolicy.CacheAndNetwork
					            ) {
					                // this will invoke pagination's refetch because of javascript's magic this binding
					                fetchQuery({
					                    context,
					                    artifact,
					                    variables: newVariables,
					                    session: context.session,
					                    cached: false,
					                })
					            }

					            // if we have a partial result and we can load the rest of the data
					            // from the network, send the request
					            if (toReturn.partial && params.policy === CachePolicy.CacheOrNetwork) {
					                fetchQuery({
					                    context,
					                    artifact,
					                    variables: newVariables,
					                    session: context.session,
					                    cached: false,
					                })
					            }

					            // update the cache with the data that we just ran into
					            cache.write({
					                selection: artifact.selection,
					                data: toReturn.result.data,
					                variables: newVariables,
					            })

					            if (updated && subscriptionSpec) {
					                cache.subscribe(subscriptionSpec, newVariables)
					            }

					            // update Current variables tracker
					            variables = newVariables
					        }

					        set({
					            ...toReturn,
					            result: {
					                ...toReturn.result,
					                data: unmarshalSelection(houdiniConfig, artifact.selection, toReturn.result.data),
					            },
					            isFetching: false,
					        })

					        return toReturn
					    }

					    

					    return {
					        subscribe: (...args) => {
					            const parentUnsubscribe = subscribe(...args)

					            // Handle unsubscribe
					            return () => {
					                if (subscriptionSpec) {
					                    cache.unsubscribe(subscriptionSpec, variables)
					                    subscriptionSpec = null
					                }
					        
					                parentUnsubscribe()
					            }
					        },

					        // For SSR
					        queryLoad,

					        // For CSR
					        query,

					        // For internal usage only.
					        setPartial: (partial) => update(s => ({...s, partial })),

					        
					    }
					}

					export const GQL_TestQuery = GQL_TestQueryStore()
				`)
})

test('forward cursor pagination', async function () {
	const docs = [
		mockCollectedDoc(`query TestQuery { 
		usersByForwardsCursor(first: 10) @paginate { 
			edges { 
				node { 
					id
				}
			}
		} 
	}`),
	]

	// run the generator
	await runPipeline(config, docs)

	const contents = await readFile(
		path.join(config.storesDirectory, config.storeName({ name: 'TestQuery' }) + '.js'),
		'utf-8'
	)

	// parse the contents
	const parsed = recast.parse(contents, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
					import { houdiniConfig } from '$houdini'
					import { stry } from '@kitql/helper'
					import { writable } from 'svelte/store'
					import { TestQuery as artifact } from '../artifacts'
					import { CachePolicy, DataSource, fetchQuery, RequestContext } from '../runtime'
					import { getSession, isBrowser } from '../runtime/adapter.mjs'
					import cache from '../runtime/cache'
					import { marshalInputs, unmarshalSelection } from '../runtime/scalars'

					// optional pagination imports 
					import { queryHandlers } from '../runtime/pagination'


					// TODO:
					// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!
					// - [ ] context client side (getPage, getSession) => GetStores issue

					function GQL_TestQueryStore() {
					    const { subscribe, set, update } = writable({
					        partial: false,
					        result: null,
					        source: null,
					        isFetching: false,
					    })

					    // Track subscriptions
					    let subscriptionSpec = null

					    // Current variables tracker
					    let variables = {}

					    
					    async function queryLoad(ctx, params) {
					        const context = new RequestContext(ctx)
					        return await queryLocal(context, params)
					    }
					    
					    async function query(params) {
					        // const sessionStore = getSession()
					        
					        const context = new RequestContext({
					            //page: getPage(),
					            fetch: fetch,
					            //session: getSession(),
					        })

					        return await queryLocal(context, params)
					    }

					    async function queryLocal(context, params) {
					        update((c) => {
					            return { ...c, isFetching: true }
					        })

					        // params management
					        params = params ?? {}
					       
					        // If no policy specified => artifact.policy, if there is nothing go to CacheOrNetwork
					        if (!params.policy) {
					            params.policy = artifact.policy ?? CachePolicy.CacheOrNetwork
					        }

					        const newVariables = marshalInputs({
					            artifact,
					            config: houdiniConfig,
					            input: params.variables,
					        })

					        let toReturn = await fetchQuery({
					            context,
					            artifact,
					            variables: newVariables,
					            session: context.session,
					            cached: params.policy !== CachePolicy.NetworkOnly,
					        })

					        // setup a subscription for new values from the cache
					        if (isBrowser) {
					            
					            subscriptionSpec = {
					                rootType: artifact.rootType,
					                selection: artifact.selection,
					                variables: () => newVariables,
					                set: set,
					            }
					            cache.subscribe(subscriptionSpec, variables)

					            const updated = stry(variables, 0) !== stry(newVariables, 0)

					            // if the variables changed we need to unsubscribe from the old fields and
					            // listen to the new ones
					            if (updated && subscriptionSpec) {
					                cache.unsubscribe(subscriptionSpec, variables)
					            }

					            // if the data was loaded from a cached value, and the document cache policy wants a
					            // network request to be sent after the data was loaded, load the data
					            if (
					                toReturn.source === DataSource.Cache &&
					                params.policy === CachePolicy.CacheAndNetwork
					            ) {
					                // this will invoke pagination's refetch because of javascript's magic this binding
					                fetchQuery({
					                    context,
					                    artifact,
					                    variables: newVariables,
					                    session: context.session,
					                    cached: false,
					                })
					            }

					            // if we have a partial result and we can load the rest of the data
					            // from the network, send the request
					            if (toReturn.partial && params.policy === CachePolicy.CacheOrNetwork) {
					                fetchQuery({
					                    context,
					                    artifact,
					                    variables: newVariables,
					                    session: context.session,
					                    cached: false,
					                })
					            }

					            // update the cache with the data that we just ran into
					            cache.write({
					                selection: artifact.selection,
					                data: toReturn.result.data,
					                variables: newVariables,
					            })

					            if (updated && subscriptionSpec) {
					                cache.subscribe(subscriptionSpec, newVariables)
					            }

					            // update Current variables tracker
					            variables = newVariables
					        }

					        set({
					            ...toReturn,
					            result: {
					                ...toReturn.result,
					                data: unmarshalSelection(houdiniConfig, artifact.selection, toReturn.result.data),
					            },
					            isFetching: false,
					        })

					        return toReturn
					    }

					    
					    const handlers = queryHandlers({
					        config: houdiniConfig,
					        artifact,
					        store: { subscribe },
					        queryVariables: () => variables 
					    })
					        

					    return {
					        subscribe: (...args) => {
					            const parentUnsubscribe = subscribe(...args)

					            // Handle unsubscribe
					            return () => {
					                if (subscriptionSpec) {
					                    cache.unsubscribe(subscriptionSpec, variables)
					                    subscriptionSpec = null
					                }
					        
					                parentUnsubscribe()
					            }
					        },

					        // For SSR
					        queryLoad,

					        // For CSR
					        query,

					        // For internal usage only.
					        setPartial: (partial) => update(s => ({...s, partial })),

					        ...{
					            loadNextPage: handlers.loadNextPage,
					            pageInfo: handlers.pageInfo,
					            query: handlers.refetch,
					            loading: handlers.loading,
					        }
					    }
					}

					export const GQL_TestQuery = GQL_TestQueryStore()
				`)
})

test('backwards cursor pagination', async function () {
	const docs = [
		mockCollectedDoc(`query TestQuery { 
		usersByBackwardsCursor(last: 10) @paginate { 
			edges { 
				node { 
					id
				}
			}
		} 
	}`),
	]

	// run the generator
	await runPipeline(config, docs)

	const contents = await readFile(
		path.join(config.storesDirectory, config.storeName({ name: 'TestQuery' }) + '.js'),
		'utf-8'
	)

	// parse the contents
	const parsed = recast.parse(contents, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
					import { houdiniConfig } from '$houdini'
					import { stry } from '@kitql/helper'
					import { writable } from 'svelte/store'
					import { TestQuery as artifact } from '../artifacts'
					import { CachePolicy, DataSource, fetchQuery, RequestContext } from '../runtime'
					import { getSession, isBrowser } from '../runtime/adapter.mjs'
					import cache from '../runtime/cache'
					import { marshalInputs, unmarshalSelection } from '../runtime/scalars'

					// optional pagination imports 
					import { queryHandlers } from '../runtime/pagination'


					// TODO:
					// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!
					// - [ ] context client side (getPage, getSession) => GetStores issue

					function GQL_TestQueryStore() {
					    const { subscribe, set, update } = writable({
					        partial: false,
					        result: null,
					        source: null,
					        isFetching: false,
					    })

					    // Track subscriptions
					    let subscriptionSpec = null

					    // Current variables tracker
					    let variables = {}

					    
					    async function queryLoad(ctx, params) {
					        const context = new RequestContext(ctx)
					        return await queryLocal(context, params)
					    }
					    
					    async function query(params) {
					        // const sessionStore = getSession()
					        
					        const context = new RequestContext({
					            //page: getPage(),
					            fetch: fetch,
					            //session: getSession(),
					        })

					        return await queryLocal(context, params)
					    }

					    async function queryLocal(context, params) {
					        update((c) => {
					            return { ...c, isFetching: true }
					        })

					        // params management
					        params = params ?? {}
					       
					        // If no policy specified => artifact.policy, if there is nothing go to CacheOrNetwork
					        if (!params.policy) {
					            params.policy = artifact.policy ?? CachePolicy.CacheOrNetwork
					        }

					        const newVariables = marshalInputs({
					            artifact,
					            config: houdiniConfig,
					            input: params.variables,
					        })

					        let toReturn = await fetchQuery({
					            context,
					            artifact,
					            variables: newVariables,
					            session: context.session,
					            cached: params.policy !== CachePolicy.NetworkOnly,
					        })

					        // setup a subscription for new values from the cache
					        if (isBrowser) {
					            
					            subscriptionSpec = {
					                rootType: artifact.rootType,
					                selection: artifact.selection,
					                variables: () => newVariables,
					                set: set,
					            }
					            cache.subscribe(subscriptionSpec, variables)

					            const updated = stry(variables, 0) !== stry(newVariables, 0)

					            // if the variables changed we need to unsubscribe from the old fields and
					            // listen to the new ones
					            if (updated && subscriptionSpec) {
					                cache.unsubscribe(subscriptionSpec, variables)
					            }

					            // if the data was loaded from a cached value, and the document cache policy wants a
					            // network request to be sent after the data was loaded, load the data
					            if (
					                toReturn.source === DataSource.Cache &&
					                params.policy === CachePolicy.CacheAndNetwork
					            ) {
					                // this will invoke pagination's refetch because of javascript's magic this binding
					                fetchQuery({
					                    context,
					                    artifact,
					                    variables: newVariables,
					                    session: context.session,
					                    cached: false,
					                })
					            }

					            // if we have a partial result and we can load the rest of the data
					            // from the network, send the request
					            if (toReturn.partial && params.policy === CachePolicy.CacheOrNetwork) {
					                fetchQuery({
					                    context,
					                    artifact,
					                    variables: newVariables,
					                    session: context.session,
					                    cached: false,
					                })
					            }

					            // update the cache with the data that we just ran into
					            cache.write({
					                selection: artifact.selection,
					                data: toReturn.result.data,
					                variables: newVariables,
					            })

					            if (updated && subscriptionSpec) {
					                cache.subscribe(subscriptionSpec, newVariables)
					            }

					            // update Current variables tracker
					            variables = newVariables
					        }

					        set({
					            ...toReturn,
					            result: {
					                ...toReturn.result,
					                data: unmarshalSelection(houdiniConfig, artifact.selection, toReturn.result.data),
					            },
					            isFetching: false,
					        })

					        return toReturn
					    }

					    
					    const handlers = queryHandlers({
					        config: houdiniConfig,
					        artifact,
					        store: { subscribe },
					        queryVariables: () => variables 
					    })
					        

					    return {
					        subscribe: (...args) => {
					            const parentUnsubscribe = subscribe(...args)

					            // Handle unsubscribe
					            return () => {
					                if (subscriptionSpec) {
					                    cache.unsubscribe(subscriptionSpec, variables)
					                    subscriptionSpec = null
					                }
					        
					                parentUnsubscribe()
					            }
					        },

					        // For SSR
					        queryLoad,

					        // For CSR
					        query,

					        // For internal usage only.
					        setPartial: (partial) => update(s => ({...s, partial })),

					        ...{
					    loadPreviousPage: handlers.loadPreviousPage,
					    pageInfo: handlers.pageInfo,
					    query: handlers.refetch,
					    loading: handlers.loading,
					        }
					    }
					}

					export const GQL_TestQuery = GQL_TestQueryStore()
				`)
})

test('offset pagination', async function () {
	const docs = [
		mockCollectedDoc(`query TestQuery { 
		usersByOffset(limit: 10) @paginate { 
			id
		} 
	}`),
	]

	// run the generator
	await runPipeline(config, docs)

	const contents = await readFile(
		path.join(config.storesDirectory, config.storeName({ name: 'TestQuery' }) + '.js'),
		'utf-8'
	)

	// parse the contents
	const parsed = recast.parse(contents, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
					import { houdiniConfig } from '$houdini'
					import { stry } from '@kitql/helper'
					import { writable } from 'svelte/store'
					import { TestQuery as artifact } from '../artifacts'
					import { CachePolicy, DataSource, fetchQuery, RequestContext } from '../runtime'
					import { getSession, isBrowser } from '../runtime/adapter.mjs'
					import cache from '../runtime/cache'
					import { marshalInputs, unmarshalSelection } from '../runtime/scalars'

					// optional pagination imports 
					import { queryHandlers } from '../runtime/pagination'


					// TODO:
					// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!
					// - [ ] context client side (getPage, getSession) => GetStores issue

					function GQL_TestQueryStore() {
					    const { subscribe, set, update } = writable({
					        partial: false,
					        result: null,
					        source: null,
					        isFetching: false,
					    })

					    // Track subscriptions
					    let subscriptionSpec = null

					    // Current variables tracker
					    let variables = {}

					    
					    async function queryLoad(ctx, params) {
					        const context = new RequestContext(ctx)
					        return await queryLocal(context, params)
					    }
					    
					    async function query(params) {
					        // const sessionStore = getSession()
					        
					        const context = new RequestContext({
					            //page: getPage(),
					            fetch: fetch,
					            //session: getSession(),
					        })

					        return await queryLocal(context, params)
					    }

					    async function queryLocal(context, params) {
					        update((c) => {
					            return { ...c, isFetching: true }
					        })

					        // params management
					        params = params ?? {}
					       
					        // If no policy specified => artifact.policy, if there is nothing go to CacheOrNetwork
					        if (!params.policy) {
					            params.policy = artifact.policy ?? CachePolicy.CacheOrNetwork
					        }

					        const newVariables = marshalInputs({
					            artifact,
					            config: houdiniConfig,
					            input: params.variables,
					        })

					        let toReturn = await fetchQuery({
					            context,
					            artifact,
					            variables: newVariables,
					            session: context.session,
					            cached: params.policy !== CachePolicy.NetworkOnly,
					        })

					        // setup a subscription for new values from the cache
					        if (isBrowser) {
					            
					            subscriptionSpec = {
					                rootType: artifact.rootType,
					                selection: artifact.selection,
					                variables: () => newVariables,
					                set: set,
					            }
					            cache.subscribe(subscriptionSpec, variables)

					            const updated = stry(variables, 0) !== stry(newVariables, 0)

					            // if the variables changed we need to unsubscribe from the old fields and
					            // listen to the new ones
					            if (updated && subscriptionSpec) {
					                cache.unsubscribe(subscriptionSpec, variables)
					            }

					            // if the data was loaded from a cached value, and the document cache policy wants a
					            // network request to be sent after the data was loaded, load the data
					            if (
					                toReturn.source === DataSource.Cache &&
					                params.policy === CachePolicy.CacheAndNetwork
					            ) {
					                // this will invoke pagination's refetch because of javascript's magic this binding
					                fetchQuery({
					                    context,
					                    artifact,
					                    variables: newVariables,
					                    session: context.session,
					                    cached: false,
					                })
					            }

					            // if we have a partial result and we can load the rest of the data
					            // from the network, send the request
					            if (toReturn.partial && params.policy === CachePolicy.CacheOrNetwork) {
					                fetchQuery({
					                    context,
					                    artifact,
					                    variables: newVariables,
					                    session: context.session,
					                    cached: false,
					                })
					            }

					            // update the cache with the data that we just ran into
					            cache.write({
					                selection: artifact.selection,
					                data: toReturn.result.data,
					                variables: newVariables,
					            })

					            if (updated && subscriptionSpec) {
					                cache.subscribe(subscriptionSpec, newVariables)
					            }

					            // update Current variables tracker
					            variables = newVariables
					        }

					        set({
					            ...toReturn,
					            result: {
					                ...toReturn.result,
					                data: unmarshalSelection(houdiniConfig, artifact.selection, toReturn.result.data),
					            },
					            isFetching: false,
					        })

					        return toReturn
					    }

					    
					    const handlers = queryHandlers({
					        config: houdiniConfig,
					        artifact,
					        store: { subscribe },
					        queryVariables: () => variables 
					    })
					        

					    return {
					        subscribe: (...args) => {
					            const parentUnsubscribe = subscribe(...args)

					            // Handle unsubscribe
					            return () => {
					                if (subscriptionSpec) {
					                    cache.unsubscribe(subscriptionSpec, variables)
					                    subscriptionSpec = null
					                }
					        
					                parentUnsubscribe()
					            }
					        },

					        // For SSR
					        queryLoad,

					        // For CSR
					        query,

					        // For internal usage only.
					        setPartial: (partial) => update(s => ({...s, partial })),

					        ...{
					            loadNextPage: handlers.loadNextPage,
					            query: handlers.refetch,
					            loading: handlers.loading,
					        }
					    }
					}

					export const GQL_TestQuery = GQL_TestQueryStore()
				`)
})
