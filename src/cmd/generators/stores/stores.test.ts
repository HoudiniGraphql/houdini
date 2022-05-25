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
					// - [x] smarter than JSON.stringify to compare if it's updated
					// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!
					// - [ ] cache policies aren't implemented yet
					// - [x] params.policy > artifact.policy
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

						// const sessionStore = getSession()

					  async function load(ctx, params) {
					    console.log('fn "load" to rename (queryLoad for autocomplete, loadQuery for better en 😜)')
					    const context = new RequestContext(ctx)
					    return await queryLocal(context, params)
					  }

					  async function query(params) {
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
					      // if we're already subscribing, don't do anything
					      // if (subscriptionSpec) {
					      // 	return
					      // }
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
					    load,

					    // For CSR
					    query,

					    
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

					import { extractPageInfo, countPage } from '../runtime/utils'
					import { executeQuery } from '../runtime/network'
					import { get } from 'svelte/store'


					// TODO:
					// - [x] smarter than JSON.stringify to compare if it's updated
					// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!
					// - [ ] cache policies aren't implemented yet
					// - [x] params.policy > artifact.policy
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

						// const sessionStore = getSession()

					  async function load(ctx, params) {
					    console.log('fn "load" to rename (queryLoad for autocomplete, loadQuery for better en 😜)')
					    const context = new RequestContext(ctx)
					    return await queryLocal(context, params)
					  }

					  async function query(params) {
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
					      // if we're already subscribing, don't do anything
					      // if (subscriptionSpec) {
					      // 	return
					      // }
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

					  
					    const initialValue = get({ subscribe })

					    // track the current page info in an easy-to-reach store
					    const initialPageInfo = extractPageInfo(initialValue, artifact.refetch.path) ?? {
					        startCursor: null,
					        endCursor: null,
					        hasNextPage: false,
					        hasPreviousPage: false,
					    }

					    const pageInfo = writable(initialPageInfo)

					    // hold onto the current value
					    subscribe((val) => {
					        if (val.result?.data) {
					            pageInfo.set(extractPageInfo(val.result.data, artifact.refetch.path))
					        }
					    })

					    // dry up the page-loading logic
					    const loadPage = async ({
					        pageSizeVar,
					        input,
					        functionName,
					    }) => {
					        // set the loading state to true
					        update(s => ({...s, isFetching: true}))

					        // build up the variables to pass to the query
					        const queryVariables = {
					            ...variables,
					            ...input,
					        }

					        // if we don't have a value for the page size, tell the user
					        if (!queryVariables[pageSizeVar] && !artifact.refetch.pageSize) {
					            throw new Error(
					                'Loading a page with no page size. If you are paginating a field with a variable page size, ' +
					                    \`you have to pass a value to \${functionName}. If you don't care to have the page size vary, \` +
					                    'consider passing a fixed value to the field instead.'
					            )
					        }

					        // send the query
					        const { result, partial: partialData } = await executeQuery(
					            artifact,
					            queryVariables,
					            sessionStore,
					            false
					        )

					        // keep the partial state up to date
					        update(s => ({...s, partial: partialData}))

					        // if the query is embedded in a node field (paginated fragments)
					        // make sure we look down one more for the updated page info
					        const resultPath = [...artifact.refetch.path]
					        if (artifact.refetch.embedded) {
					            const { targetType } = artifact.refetch
					            // make sure we have a type config for the pagination target type
					            if (!config.types?.[targetType]?.resolve) {
					                throw new Error(
					                    \`Missing type resolve configuration for \${targetType}. For more information, see https://www.houdinigraphql.com/guides/pagination#paginated-fragments\`
					                )
					            }

					            // make sure that we pull the value out of the correct query field
					            resultPath.unshift(config.types[targetType].resolve.queryField)
					        }

					        // we need to find the connection object holding the current page info
					        pageInfo.set(extractPageInfo(result.data, resultPath))

					        // updating cache with the result will update the store value
					        cache.write({
					            selection: artifact.selection,
					            data: result.data,
					            variables: queryVariables,
					            applyUpdates: true,
					        })

					        // we're not loading any more
					        update(s => ({...s, isFetching: false }))
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
					    load,

					    // For CSR
					    query,

					    ...{
					      loadNextPage: (pageCount) => {
					          const value = get({subscribe}).result.data

					          // we need to find the connection object holding the current page info
					          const currentPageInfo = extractPageInfo(value, artifact.refetch.path)

					          // if there is no next page, we're done
					          if (!currentPageInfo.hasNextPage) {
					              return
					          }

					          // only specify the page count if we're given one
					          const input = {
					              after: currentPageInfo.endCursor,
					          }
					          if (pageCount) {
					              input.first = pageCount
					          }

					          // load the page
					          return loadPage({
					              pageSizeVar: 'first',
					              functionName: 'loadNextPage',
					              input,
					          })
					      },
					      pageInfo: { subscribe: pageInfo.subscribe },
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

					import { extractPageInfo, countPage } from '../runtime/utils'
					import { executeQuery } from '../runtime/network'
					import { get } from 'svelte/store'


					// TODO:
					// - [x] smarter than JSON.stringify to compare if it's updated
					// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!
					// - [ ] cache policies aren't implemented yet
					// - [x] params.policy > artifact.policy
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

						// const sessionStore = getSession()

					  async function load(ctx, params) {
					    console.log('fn "load" to rename (queryLoad for autocomplete, loadQuery for better en 😜)')
					    const context = new RequestContext(ctx)
					    return await queryLocal(context, params)
					  }

					  async function query(params) {
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
					      // if we're already subscribing, don't do anything
					      // if (subscriptionSpec) {
					      // 	return
					      // }
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

					  
					    const initialValue = get({ subscribe })

					    // track the current page info in an easy-to-reach store
					    const initialPageInfo = extractPageInfo(initialValue, artifact.refetch.path) ?? {
					        startCursor: null,
					        endCursor: null,
					        hasNextPage: false,
					        hasPreviousPage: false,
					    }

					    const pageInfo = writable(initialPageInfo)

					    // hold onto the current value
					    subscribe((val) => {
					        if (val.result?.data) {
					            pageInfo.set(extractPageInfo(val.result.data, artifact.refetch.path))
					        }
					    })

					    // dry up the page-loading logic
					    const loadPage = async ({
					        pageSizeVar,
					        input,
					        functionName,
					    }) => {
					        // set the loading state to true
					        update(s => ({...s, isFetching: true}))

					        // build up the variables to pass to the query
					        const queryVariables = {
					            ...variables,
					            ...input,
					        }

					        // if we don't have a value for the page size, tell the user
					        if (!queryVariables[pageSizeVar] && !artifact.refetch.pageSize) {
					            throw new Error(
					                'Loading a page with no page size. If you are paginating a field with a variable page size, ' +
					                    \`you have to pass a value to \${functionName}. If you don't care to have the page size vary, \` +
					                    'consider passing a fixed value to the field instead.'
					            )
					        }

					        // send the query
					        const { result, partial: partialData } = await executeQuery(
					            artifact,
					            queryVariables,
					            sessionStore,
					            false
					        )

					        // keep the partial state up to date
					        update(s => ({...s, partial: partialData}))

					        // if the query is embedded in a node field (paginated fragments)
					        // make sure we look down one more for the updated page info
					        const resultPath = [...artifact.refetch.path]
					        if (artifact.refetch.embedded) {
					            const { targetType } = artifact.refetch
					            // make sure we have a type config for the pagination target type
					            if (!config.types?.[targetType]?.resolve) {
					                throw new Error(
					                    \`Missing type resolve configuration for \${targetType}. For more information, see https://www.houdinigraphql.com/guides/pagination#paginated-fragments\`
					                )
					            }

					            // make sure that we pull the value out of the correct query field
					            resultPath.unshift(config.types[targetType].resolve.queryField)
					        }

					        // we need to find the connection object holding the current page info
					        pageInfo.set(extractPageInfo(result.data, resultPath))

					        // updating cache with the result will update the store value
					        cache.write({
					            selection: artifact.selection,
					            data: result.data,
					            variables: queryVariables,
					            applyUpdates: true,
					        })

					        // we're not loading any more
					        update(s => ({...s, isFetching: false }))
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
					    load,

					    // For CSR
					    query,

					    ...{
					      loadPreviousPage: (pageCount) => {
					          const value = get({subscribe}).result.data

					          // we need to find the connection object holding the current page info
					          const currentPageInfo = extractPageInfo(value, artifact.refetch.path)

					          // if there is no next page, we're done
					          if (!currentPageInfo.hasPreviousPage) {
					              return
					          }

					          // only specify the page count if we're given one
					          const input = {
					              before: currentPageInfo.startCursor,
					          }
					          if (pageCount) {
					              input.last = pageCount
					          }

					          // load the page
					          return loadPage({
					              pageSizeVar: 'last',
					              functionName: 'loadPreviousPage',
					              input,
					          })
					      },
					      pageInfo: { subscribe: pageInfo.subscribe },
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

					import { countPage } from '../runtime/utils'


					// TODO:
					// - [x] smarter than JSON.stringify to compare if it's updated
					// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!
					// - [ ] cache policies aren't implemented yet
					// - [x] params.policy > artifact.policy
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

						// const sessionStore = getSession()

					  async function load(ctx, params) {
					    console.log('fn "load" to rename (queryLoad for autocomplete, loadQuery for better en 😜)')
					    const context = new RequestContext(ctx)
					    return await queryLocal(context, params)
					  }

					  async function query(params) {
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
					      // if we're already subscribing, don't do anything
					      // if (subscriptionSpec) {
					      // 	return
					      // }
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

					  
					    // we need to track the most recent offset for this handler
					    let currentOffset = (artifact.refetch?.start as number) || 0


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
					    load,

					    // For CSR
					    query,

					    ...{
					      loadPage: async (limit) => {
					        // build up the variables to pass to the query
					        const queryVariables = {
					            ...variables,
					            offset: currentOffset,
					        }
					        if (limit) {
					            queryVariables.limit = limit
					        }

					        // if we made it this far without a limit argument and there's no default page size,
					        // they made a mistake
					        if (!queryVariables.limit && !artifact.refetch.pageSize) {
					            throw new Error(
					                'Loading a page with no page size. If you are paginating a field with a variable page size, ' +
					                    \`you have to pass a value to loadNextPage. If you don't care to have the page size vary, \` +
					                    'consider passing a fixed value to the field instead.'
					            )
					        }

					        // set the loading state to true
					        update(s => ({...s, isFetching: true}))

					        // send the query
					        const { result, partial: partialData } = await executeQuery(
					            artifact,
					            queryVariables,
					            sessionStore,
					            false
					        )
					        update(s => ({...s, partial: partialData}))

					        // update cache with the result
					        cache.write({
					            selection: artifact.selection,
					            data: result.data,
					            variables: queryVariables,
					            applyUpdates: true,
					        })

					        // add the page size to the offset so we load the next page next time
					        const pageSize = queryVariables.limit || artifact.refetch.pageSize
					        currentOffset += pageSize

					        // we're not loading any more
					        update(s => ({...s, isFetching: false}))
					      },
					    }
					  }
					}

					export const GQL_TestQuery = GQL_TestQueryStore()
				`)
})
