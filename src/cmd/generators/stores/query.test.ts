// external imports
import path, { parse } from 'path'
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
import { readFile, stat } from 'fs/promises'

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
	expect(files).toEqual(expect.arrayContaining(['TestQuery1.js', 'TestQuery2.js']))
	// and type definitions exist
	expect(files).toEqual(expect.arrayContaining(['TestQuery1.d.ts', 'TestQuery2.d.ts']))
})

test('basic store', async function () {
	const docs = [mockCollectedDoc(`query TestQuery { version }`)]

	// run the generator
	await runPipeline(config, docs)

	const contents = await readFile(path.join(config.storesDirectory, 'TestQuery.js'), 'utf-8')

	// parse the contents
	const parsed = recast.parse(contents, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
					import { houdiniConfig } from '$houdini';
					import { logCyan, logRed, logYellow, stry } from '@kitql/helper';
					import { writable } from 'svelte/store';
					import { onMount } from 'svelte'
					import { TestQuery as artifact } from '../artifacts';
					import {
					    CachePolicy,
					    DataSource, errorsToGraphQLLayout, fetchQuery,
					    RequestContext
					} from '../runtime';
					import { clientStarted, isBrowser } from '../runtime/adapter.mjs';
					import { defaultConfigValues } from '../runtime/config'
					import cache from '../runtime/cache';
					import { marshalInputs, unmarshalSelection } from '../runtime/scalars';

					const config = defaultConfigValues(houdiniConfig)

					// optional pagination imports


					// TODO:
					// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!

					function GQL_TestQueryStore() {
					    const { subscribe, set, update } = writable({
					        data: null,
					        errors: null,
					        isFetching: false,
					        partial: false,
					        source: null,
					        variables: null
					    });

					    // Track subscriptions
					    let subscriptionSpec = null

					    // Current variables tracker
					    let variables = {}

					    async function fetchLocal(params) {
					        params = params ?? {};
					        if (!params.context) {
					            params.context = {};
					        }

					        if (!isBrowser && !params.event) {
					            // prettier-ignore
					            console.error(
					            \`\${logRed('I think that either')}:

					            \${logRed('1/')} you forgot to provide \${logYellow('event')}! As we are in context="module" (SSR) here.
					                    It should be something like:

					                <script context="module" lang="ts">
					                import type { LoadEvent } from '@sveltejs/kit';

					                export async function load(\${logYellow('event')}: LoadEvent) {
					                    \${logYellow('await')} \${logCyan('GQL_TestQuery')}.fetch({ \${logYellow('event')}, variables: { ... } });
					                    return {};
					                }
					                </script>

					                \${logRed('2/')} you should run this in a browser only.\`
					            );
					            throw new Error('Error, check logs for help.');
					        }

					        // if we have event, we should be in the load function
					        if (params.event) {
					            if (clientStarted && !params.blocking) {
					                queryLoad(params); // No await on purpose, we are in a client navigation.
					            } else {
					                return await queryLoad(params);
					            }
					        } else {
					            // event is missing and we are in the browser... we will get a "Function called outside component initialization"... Would be nice to warn the user!

					            // else
					            return await query(params);
					        }
					    }

					    function queryLoad(params) {
							const context = new RequestContext(params.event)
							return queryLocal(context, params)
						}

						async function query(params) {
							const context = new RequestContext({
					            fetch: fetch,
					            page: params.context.page,
					            session: params.context.session
					        });

							return await queryLocal(context, {
					            ...params,
					            variables: {...variables, ...params.variables }
					        })
						}

					    let latestSource = null
					    let latestPartial = false

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
					            config,
					            input: params.variables
					        })

					        // Todo: validate inputs before we query the api

					        const { result, source, partial } = await fetchQuery({
					            context,
					            artifact,
					            variables: newVariables,
					            session: context.session,
					            cached: params.policy !== CachePolicy.NetworkOnly,
					        })

					        // keep the trackers up to date
					        latestSource = source
					        latestPartial = partial

					        if (result.errors && result.errors.length > 0) {
					            update((s) => ({
					                ...s,
					                errors: result.errors,
					                isFetching: false,
					                partial: false,
					                data: result.data,
					                source,
					                variables: newVariables
					            }));
					            throw result.errors;
					        }

					        // setup a subscription for new values from the cache
					        if (isBrowser) {
					            const updated = JSON.stringify(variables) !== JSON.stringify(newVariables)

					            // if the variables changed we need to unsubscribe from the old fields and
					            // listen to the new ones
					            if (updated && subscriptionSpec) {
					                cache.unsubscribe(subscriptionSpec, variables)
					            }

					            // update the cache with the data that we just ran into
					            cache.write({
					                selection: artifact.selection,
					                data: result.data,
					                variables: newVariables,
					            })

					            if (updated && subscriptionSpec) {
					                cache.subscribe(subscriptionSpec, newVariables)
					            }
					        }

					        // update Current variables tracker
					        variables = newVariables

					        // prepare store data
					        const storeData = {
					            data: unmarshalSelection(config, artifact.selection, result.data),
					            error: result.errors,
					            isFetching: false,
					            partial: partial,
					            source: source,
					            variables: newVariables
					        }

					        // update the store value
					        set(storeData)

					        // return the value to the caller
					        return storeData
					    }



					    return {
					        subscribe: (...args) => {
					            const parentUnsubscribe = subscribe(...args)

					            onMount(() => {
					                // if the data was loaded from a cached value, and the document cache policy wants a
					                // network request to be sent after the data was loaded, load the data
					                if (latestSource === DataSource.Cache && artifact.policy === CachePolicy.CacheAndNetwork) {
					                    // this will invoke pagination's refetch because of javascript's magic this binding
					                    fetchQuery({
					                        context,
					                        artifact,
					                        variables: variables,
					                        session: context.session,
					                        cached: false
					                    });
					                }

					                // if we have a partial result and we can load the rest of the data
					                // from the network, send the request
					                if (latestPartial && artifact.policy === CachePolicy.CacheOrNetwork) {
					                    fetchQuery({
					                        context,
					                        artifact,
					                        variables: variables,
					                        session: context.session,
					                        cached: false
					                    });
					                }

					                // subscribe to cache updates
					                subscriptionSpec = {
					                    rootType: artifact.rootType,
					                    selection: artifact.selection,
					                    variables: () => variables,
					                    set: (data) => update((s) => ({ ...s, data }))
					                }
					                cache.subscribe(subscriptionSpec, variables)
					            });

					            // Handle unsubscribe
					            return () => {
					                if (subscriptionSpec) {
					                    cache.unsubscribe(subscriptionSpec, variables)
					                    subscriptionSpec = null
					                }

					                latestSource = null
					                latestPartial = null

					                parentUnsubscribe()
					            }
					        },

					        fetch: fetchLocal,

					        
					    }
					}

					const store = GQL_TestQueryStore()

					export default store

					export const GQL_TestQuery = store
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

	const contents = await readFile(path.join(config.storesDirectory, 'TestQuery.js'), 'utf-8')

	// parse the contents
	const parsed = recast.parse(contents, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
					import { houdiniConfig } from '$houdini';
					import { logCyan, logRed, logYellow, stry } from '@kitql/helper';
					import { writable } from 'svelte/store';
					import { onMount } from 'svelte'
					import { TestQuery as artifact } from '../artifacts';
					import {
					    CachePolicy,
					    DataSource, errorsToGraphQLLayout, fetchQuery,
					    RequestContext
					} from '../runtime';
					import { clientStarted, isBrowser } from '../runtime/adapter.mjs';
					import { defaultConfigValues } from '../runtime/config'
					import cache from '../runtime/cache';
					import { marshalInputs, unmarshalSelection } from '../runtime/scalars';

					const config = defaultConfigValues(houdiniConfig)

					// optional pagination imports
					import { queryHandlers } from '../runtime/pagination'


					// TODO:
					// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!

					function GQL_TestQueryStore() {
					    const { subscribe, set, update } = writable({
					        data: null,
					        errors: null,
					        isFetching: false,
					        partial: false,
					        source: null,
					        variables: null
					    });

					    // Track subscriptions
					    let subscriptionSpec = null

					    // Current variables tracker
					    let variables = {}

					    async function fetchLocal(params) {
					        params = params ?? {};
					        if (!params.context) {
					            params.context = {};
					        }

					        if (!isBrowser && !params.event) {
					            // prettier-ignore
					            console.error(
					            \`\${logRed('I think that either')}:

					            \${logRed('1/')} you forgot to provide \${logYellow('event')}! As we are in context="module" (SSR) here.
					                    It should be something like:

					                <script context="module" lang="ts">
					                import type { LoadEvent } from '@sveltejs/kit';

					                export async function load(\${logYellow('event')}: LoadEvent) {
					                    \${logYellow('await')} \${logCyan('GQL_TestQuery')}.fetch({ \${logYellow('event')}, variables: { ... } });
					                    return {};
					                }
					                </script>

					                \${logRed('2/')} you should run this in a browser only.\`
					            );
					            throw new Error('Error, check logs for help.');
					        }

					        // if we have event, we should be in the load function
					        if (params.event) {
					            if (clientStarted && !params.blocking) {
					                queryLoad(params); // No await on purpose, we are in a client navigation.
					            } else {
					                return await queryLoad(params);
					            }
					        } else {
					            // event is missing and we are in the browser... we will get a "Function called outside component initialization"... Would be nice to warn the user!

					            // else
					            return await query(params);
					        }
					    }

					    function queryLoad(params) {
							const context = new RequestContext(params.event)
							return queryLocal(context, params)
						}

						async function query(params) {
							const context = new RequestContext({
					            fetch: fetch,
					            page: params.context.page,
					            session: params.context.session
					        });

							return await queryLocal(context, {
					            ...params,
					            variables: {...variables, ...params.variables }
					        })
						}

					    let latestSource = null
					    let latestPartial = false

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
					            config,
					            input: params.variables
					        })

					        // Todo: validate inputs before we query the api

					        const { result, source, partial } = await fetchQuery({
					            context,
					            artifact,
					            variables: newVariables,
					            session: context.session,
					            cached: params.policy !== CachePolicy.NetworkOnly,
					        })

					        // keep the trackers up to date
					        latestSource = source
					        latestPartial = partial

					        if (result.errors && result.errors.length > 0) {
					            update((s) => ({
					                ...s,
					                errors: result.errors,
					                isFetching: false,
					                partial: false,
					                data: result.data,
					                source,
					                variables: newVariables
					            }));
					            throw result.errors;
					        }

					        // setup a subscription for new values from the cache
					        if (isBrowser) {
					            const updated = JSON.stringify(variables) !== JSON.stringify(newVariables)

					            // if the variables changed we need to unsubscribe from the old fields and
					            // listen to the new ones
					            if (updated && subscriptionSpec) {
					                cache.unsubscribe(subscriptionSpec, variables)
					            }

					            // update the cache with the data that we just ran into
					            cache.write({
					                selection: artifact.selection,
					                data: result.data,
					                variables: newVariables,
					            })

					            if (updated && subscriptionSpec) {
					                cache.subscribe(subscriptionSpec, newVariables)
					            }
					        }

					        // update Current variables tracker
					        variables = newVariables

					        // prepare store data
					        const storeData = {
					            data: unmarshalSelection(config, artifact.selection, result.data),
					            error: result.errors,
					            isFetching: false,
					            partial: partial,
					            source: source,
					            variables: newVariables
					        }

					        // update the store value
					        set(storeData)

					        // return the value to the caller
					        return storeData
					    }


						const handlers =
							queryHandlers({
								config,
								artifact,
								store: { subscribe, fetch: fetchLocal },
								queryVariables: () => variables
							})


					    return {
					        subscribe: (...args) => {
					            const parentUnsubscribe = subscribe(...args)

					            onMount(() => {
					                // if the data was loaded from a cached value, and the document cache policy wants a
					                // network request to be sent after the data was loaded, load the data
					                if (latestSource === DataSource.Cache && artifact.policy === CachePolicy.CacheAndNetwork) {
					                    // this will invoke pagination's refetch because of javascript's magic this binding
					                    fetchQuery({
					                        context,
					                        artifact,
					                        variables: variables,
					                        session: context.session,
					                        cached: false
					                    });
					                }

					                // if we have a partial result and we can load the rest of the data
					                // from the network, send the request
					                if (latestPartial && artifact.policy === CachePolicy.CacheOrNetwork) {
					                    fetchQuery({
					                        context,
					                        artifact,
					                        variables: variables,
					                        session: context.session,
					                        cached: false
					                    });
					                }

					                // subscribe to cache updates
					                subscriptionSpec = {
					                    rootType: artifact.rootType,
					                    selection: artifact.selection,
					                    variables: () => variables,
					                    set: (data) => update((s) => ({ ...s, data }))
					                }
					                cache.subscribe(subscriptionSpec, variables)
					            });

					            // Handle unsubscribe
					            return () => {
					                if (subscriptionSpec) {
					                    cache.unsubscribe(subscriptionSpec, variables)
					                    subscriptionSpec = null
					                }

					                latestSource = null
					                latestPartial = null

					                parentUnsubscribe()
					            }
					        },

					        fetch: fetchLocal,

					        ...{
					            loadNextPage: handlers.loadNextPage,
					            pageInfo: handlers.pageInfo,
					            fetch: handlers.refetch,
					            loading: handlers.loading,
					        }
					    }
					}

					const store = GQL_TestQueryStore()

					export default store

					export const GQL_TestQuery = store
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

	const contents = await readFile(path.join(config.storesDirectory, 'TestQuery.js'), 'utf-8')

	// parse the contents
	const parsed = recast.parse(contents, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
					import { houdiniConfig } from '$houdini';
					import { logCyan, logRed, logYellow, stry } from '@kitql/helper';
					import { writable } from 'svelte/store';
					import { onMount } from 'svelte'
					import { TestQuery as artifact } from '../artifacts';
					import {
					    CachePolicy,
					    DataSource, errorsToGraphQLLayout, fetchQuery,
					    RequestContext
					} from '../runtime';
					import { clientStarted, isBrowser } from '../runtime/adapter.mjs';
					import { defaultConfigValues } from '../runtime/config'
					import cache from '../runtime/cache';
					import { marshalInputs, unmarshalSelection } from '../runtime/scalars';

					const config = defaultConfigValues(houdiniConfig)

					// optional pagination imports
					import { queryHandlers } from '../runtime/pagination'


					// TODO:
					// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!

					function GQL_TestQueryStore() {
					    const { subscribe, set, update } = writable({
					        data: null,
					        errors: null,
					        isFetching: false,
					        partial: false,
					        source: null,
					        variables: null
					    });

					    // Track subscriptions
					    let subscriptionSpec = null

					    // Current variables tracker
					    let variables = {}

					    async function fetchLocal(params) {
					        params = params ?? {};
					        if (!params.context) {
					            params.context = {};
					        }

					        if (!isBrowser && !params.event) {
					            // prettier-ignore
					            console.error(
					            \`\${logRed('I think that either')}:

					            \${logRed('1/')} you forgot to provide \${logYellow('event')}! As we are in context="module" (SSR) here.
					                    It should be something like:

					                <script context="module" lang="ts">
					                import type { LoadEvent } from '@sveltejs/kit';

					                export async function load(\${logYellow('event')}: LoadEvent) {
					                    \${logYellow('await')} \${logCyan('GQL_TestQuery')}.fetch({ \${logYellow('event')}, variables: { ... } });
					                    return {};
					                }
					                </script>

					                \${logRed('2/')} you should run this in a browser only.\`
					            );
					            throw new Error('Error, check logs for help.');
					        }

					        // if we have event, we should be in the load function
					        if (params.event) {
					            if (clientStarted && !params.blocking) {
					                queryLoad(params); // No await on purpose, we are in a client navigation.
					            } else {
					                return await queryLoad(params);
					            }
					        } else {
					            // event is missing and we are in the browser... we will get a "Function called outside component initialization"... Would be nice to warn the user!

					            // else
					            return await query(params);
					        }
					    }

					    function queryLoad(params) {
							const context = new RequestContext(params.event)
							return queryLocal(context, params)
						}

						async function query(params) {
							const context = new RequestContext({
					            fetch: fetch,
					            page: params.context.page,
					            session: params.context.session
					        });

							return await queryLocal(context, {
					            ...params,
					            variables: {...variables, ...params.variables }
					        })
						}

					    let latestSource = null
					    let latestPartial = false

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
					            config,
					            input: params.variables
					        })

					        // Todo: validate inputs before we query the api

					        const { result, source, partial } = await fetchQuery({
					            context,
					            artifact,
					            variables: newVariables,
					            session: context.session,
					            cached: params.policy !== CachePolicy.NetworkOnly,
					        })

					        // keep the trackers up to date
					        latestSource = source
					        latestPartial = partial

					        if (result.errors && result.errors.length > 0) {
					            update((s) => ({
					                ...s,
					                errors: result.errors,
					                isFetching: false,
					                partial: false,
					                data: result.data,
					                source,
					                variables: newVariables
					            }));
					            throw result.errors;
					        }

					        // setup a subscription for new values from the cache
					        if (isBrowser) {
					            const updated = JSON.stringify(variables) !== JSON.stringify(newVariables)

					            // if the variables changed we need to unsubscribe from the old fields and
					            // listen to the new ones
					            if (updated && subscriptionSpec) {
					                cache.unsubscribe(subscriptionSpec, variables)
					            }

					            // update the cache with the data that we just ran into
					            cache.write({
					                selection: artifact.selection,
					                data: result.data,
					                variables: newVariables,
					            })

					            if (updated && subscriptionSpec) {
					                cache.subscribe(subscriptionSpec, newVariables)
					            }
					        }

					        // update Current variables tracker
					        variables = newVariables

					        // prepare store data
					        const storeData = {
					            data: unmarshalSelection(config, artifact.selection, result.data),
					            error: result.errors,
					            isFetching: false,
					            partial: partial,
					            source: source,
					            variables: newVariables
					        }

					        // update the store value
					        set(storeData)

					        // return the value to the caller
					        return storeData
					    }


						const handlers =
							queryHandlers({
								config,
								artifact,
								store: { subscribe, fetch: fetchLocal },
								queryVariables: () => variables
							})


					    return {
					        subscribe: (...args) => {
					            const parentUnsubscribe = subscribe(...args)

					            onMount(() => {
					                // if the data was loaded from a cached value, and the document cache policy wants a
					                // network request to be sent after the data was loaded, load the data
					                if (latestSource === DataSource.Cache && artifact.policy === CachePolicy.CacheAndNetwork) {
					                    // this will invoke pagination's refetch because of javascript's magic this binding
					                    fetchQuery({
					                        context,
					                        artifact,
					                        variables: variables,
					                        session: context.session,
					                        cached: false
					                    });
					                }

					                // if we have a partial result and we can load the rest of the data
					                // from the network, send the request
					                if (latestPartial && artifact.policy === CachePolicy.CacheOrNetwork) {
					                    fetchQuery({
					                        context,
					                        artifact,
					                        variables: variables,
					                        session: context.session,
					                        cached: false
					                    });
					                }

					                // subscribe to cache updates
					                subscriptionSpec = {
					                    rootType: artifact.rootType,
					                    selection: artifact.selection,
					                    variables: () => variables,
					                    set: (data) => update((s) => ({ ...s, data }))
					                }
					                cache.subscribe(subscriptionSpec, variables)
					            });

					            // Handle unsubscribe
					            return () => {
					                if (subscriptionSpec) {
					                    cache.unsubscribe(subscriptionSpec, variables)
					                    subscriptionSpec = null
					                }

					                latestSource = null
					                latestPartial = null

					                parentUnsubscribe()
					            }
					        },

					        fetch: fetchLocal,

					        ...{
					    loadPreviousPage: handlers.loadPreviousPage,
					    pageInfo: handlers.pageInfo,
					    fetch: handlers.refetch,
					    loading: handlers.loading,
					        }
					    }
					}

					const store = GQL_TestQueryStore()

					export default store

					export const GQL_TestQuery = store
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

	const contents = await readFile(path.join(config.storesDirectory, 'TestQuery.js'), 'utf-8')

	// parse the contents
	const parsed = recast.parse(contents, {
		parser: typeScriptParser,
	}).program

	// check the file contents
	await expect(parsed).toMatchInlineSnapshot(`
					import { houdiniConfig } from '$houdini';
					import { logCyan, logRed, logYellow, stry } from '@kitql/helper';
					import { writable } from 'svelte/store';
					import { onMount } from 'svelte'
					import { TestQuery as artifact } from '../artifacts';
					import {
					    CachePolicy,
					    DataSource, errorsToGraphQLLayout, fetchQuery,
					    RequestContext
					} from '../runtime';
					import { clientStarted, isBrowser } from '../runtime/adapter.mjs';
					import { defaultConfigValues } from '../runtime/config'
					import cache from '../runtime/cache';
					import { marshalInputs, unmarshalSelection } from '../runtime/scalars';

					const config = defaultConfigValues(houdiniConfig)

					// optional pagination imports
					import { queryHandlers } from '../runtime/pagination'


					// TODO:
					// - [ ] track: https://github.com/sveltejs/kit/issues/2979 is see if we could have a better load without context!

					function GQL_TestQueryStore() {
					    const { subscribe, set, update } = writable({
					        data: null,
					        errors: null,
					        isFetching: false,
					        partial: false,
					        source: null,
					        variables: null
					    });

					    // Track subscriptions
					    let subscriptionSpec = null

					    // Current variables tracker
					    let variables = {}

					    async function fetchLocal(params) {
					        params = params ?? {};
					        if (!params.context) {
					            params.context = {};
					        }

					        if (!isBrowser && !params.event) {
					            // prettier-ignore
					            console.error(
					            \`\${logRed('I think that either')}:

					            \${logRed('1/')} you forgot to provide \${logYellow('event')}! As we are in context="module" (SSR) here.
					                    It should be something like:

					                <script context="module" lang="ts">
					                import type { LoadEvent } from '@sveltejs/kit';

					                export async function load(\${logYellow('event')}: LoadEvent) {
					                    \${logYellow('await')} \${logCyan('GQL_TestQuery')}.fetch({ \${logYellow('event')}, variables: { ... } });
					                    return {};
					                }
					                </script>

					                \${logRed('2/')} you should run this in a browser only.\`
					            );
					            throw new Error('Error, check logs for help.');
					        }

					        // if we have event, we should be in the load function
					        if (params.event) {
					            if (clientStarted && !params.blocking) {
					                queryLoad(params); // No await on purpose, we are in a client navigation.
					            } else {
					                return await queryLoad(params);
					            }
					        } else {
					            // event is missing and we are in the browser... we will get a "Function called outside component initialization"... Would be nice to warn the user!

					            // else
					            return await query(params);
					        }
					    }

					    function queryLoad(params) {
							const context = new RequestContext(params.event)
							return queryLocal(context, params)
						}

						async function query(params) {
							const context = new RequestContext({
					            fetch: fetch,
					            page: params.context.page,
					            session: params.context.session
					        });

							return await queryLocal(context, {
					            ...params,
					            variables: {...variables, ...params.variables }
					        })
						}

					    let latestSource = null
					    let latestPartial = false

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
					            config,
					            input: params.variables
					        })

					        // Todo: validate inputs before we query the api

					        const { result, source, partial } = await fetchQuery({
					            context,
					            artifact,
					            variables: newVariables,
					            session: context.session,
					            cached: params.policy !== CachePolicy.NetworkOnly,
					        })

					        // keep the trackers up to date
					        latestSource = source
					        latestPartial = partial

					        if (result.errors && result.errors.length > 0) {
					            update((s) => ({
					                ...s,
					                errors: result.errors,
					                isFetching: false,
					                partial: false,
					                data: result.data,
					                source,
					                variables: newVariables
					            }));
					            throw result.errors;
					        }

					        // setup a subscription for new values from the cache
					        if (isBrowser) {
					            const updated = JSON.stringify(variables) !== JSON.stringify(newVariables)

					            // if the variables changed we need to unsubscribe from the old fields and
					            // listen to the new ones
					            if (updated && subscriptionSpec) {
					                cache.unsubscribe(subscriptionSpec, variables)
					            }

					            // update the cache with the data that we just ran into
					            cache.write({
					                selection: artifact.selection,
					                data: result.data,
					                variables: newVariables,
					            })

					            if (updated && subscriptionSpec) {
					                cache.subscribe(subscriptionSpec, newVariables)
					            }
					        }

					        // update Current variables tracker
					        variables = newVariables

					        // prepare store data
					        const storeData = {
					            data: unmarshalSelection(config, artifact.selection, result.data),
					            error: result.errors,
					            isFetching: false,
					            partial: partial,
					            source: source,
					            variables: newVariables
					        }

					        // update the store value
					        set(storeData)

					        // return the value to the caller
					        return storeData
					    }


						const handlers =
							queryHandlers({
								config,
								artifact,
								store: { subscribe, fetch: fetchLocal },
								queryVariables: () => variables
							})


					    return {
					        subscribe: (...args) => {
					            const parentUnsubscribe = subscribe(...args)

					            onMount(() => {
					                // if the data was loaded from a cached value, and the document cache policy wants a
					                // network request to be sent after the data was loaded, load the data
					                if (latestSource === DataSource.Cache && artifact.policy === CachePolicy.CacheAndNetwork) {
					                    // this will invoke pagination's refetch because of javascript's magic this binding
					                    fetchQuery({
					                        context,
					                        artifact,
					                        variables: variables,
					                        session: context.session,
					                        cached: false
					                    });
					                }

					                // if we have a partial result and we can load the rest of the data
					                // from the network, send the request
					                if (latestPartial && artifact.policy === CachePolicy.CacheOrNetwork) {
					                    fetchQuery({
					                        context,
					                        artifact,
					                        variables: variables,
					                        session: context.session,
					                        cached: false
					                    });
					                }

					                // subscribe to cache updates
					                subscriptionSpec = {
					                    rootType: artifact.rootType,
					                    selection: artifact.selection,
					                    variables: () => variables,
					                    set: (data) => update((s) => ({ ...s, data }))
					                }
					                cache.subscribe(subscriptionSpec, variables)
					            });

					            // Handle unsubscribe
					            return () => {
					                if (subscriptionSpec) {
					                    cache.unsubscribe(subscriptionSpec, variables)
					                    subscriptionSpec = null
					                }

					                latestSource = null
					                latestPartial = null

					                parentUnsubscribe()
					            }
					        },

					        fetch: fetchLocal,

					        ...{
					            loadNextPage: handlers.loadNextPage,
					            fetch: handlers.refetch,
					            loading: handlers.loading,
					        }
					    }
					}

					const store = GQL_TestQueryStore()

					export default store

					export const GQL_TestQuery = store
				`)
})

test('does not generate pagination store', async function () {
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

	await expect(
		stat(path.join(config.storesDirectory, config.paginationQueryName('TestQuery') + '.js'))
	).rejects.toBeTruthy()
})
