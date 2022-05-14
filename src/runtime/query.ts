// externals
import { Readable, get, writable, readable, derived } from 'svelte/store'
import { onDestroy, onMount } from 'svelte'
// locals
import type { ConfigFile } from './config'
import {
	Operation,
	GraphQLTagResult,
	QueryArtifact,
	CachePolicy,
	GraphQLObject,
	DataSource,
	StoreParams,
	QueryResult,
} from './types'
import cache from './cache'
import { QueryInputs, RequestPayload } from './network'
import { marshalInputs, unmarshalSelection } from './scalars'
import type { FetchQueryResult } from './network'

// @ts-ignore: this file will get generated and does not exist in the source code
import { getSession, getPage, goTo, isBrowser } from './adapter.mjs'

export function query<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): QueryResponse<_Query['result'], _Query['input']> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniQuery') {
		throw new Error('query() must be passed a query document')
	}

	// build some derived stores for the atomic values
	const data = derived(document.store, ($store) => $store.data)
	const loading = derived(document.store, ($store) => $store.isFetching)
	const partial = derived(document.store, ($store) => $store.partial)
	const error = derived(document.store, ($store) => $store.error)

	// TODO: non-route logic
	if (document.component) {
	}

	return {
		data,
		refetch: document.store.query,
		error,
		loading,
		partial,
	}
}

// we need to wrap the response from a query in something that we can
// use as a proxy to the query for refetches, writing to the cache, etc
export type QueryResponse<_Data, _Input> = {
	data: Readable<_Data>
	refetch: (newVariables?: StoreParams<_Input>) => Promise<QueryResult<_Data>>
	loading: Readable<boolean>
	partial: Readable<boolean>
	error: Readable<Error | null>
}

// // component queries are implemented as wrappers over the normal query that fire the
// // appropriate network request and then write the result to the underlying store
// export const componentQuery = <_Data extends GraphQLObject, _Input>({
// 	config,
// 	artifact,
// 	queryHandler,
// 	variableFunction,
// 	getProps,
// }: {
// 	config: ConfigFile
// 	artifact: QueryArtifact
// 	queryHandler: QueryResponse<_Data, _Input>
// 	variableFunction: ((...args: any[]) => _Input) | null
// 	getProps: () => any
// }): QueryResponse<_Data, _Input> => {
// 	// pull out the function we'll use to update the store after we've fired it
// 	const { writeData, refetch } = queryHandler

// 	// we need our own store to track loading state (the handler's isn't meaningful)
// 	const loading = writable(true)
// 	// a store to track the error state
// 	const error = writable<Error | null>(null)

// 	// compute the variables for the request
// 	let variables: _Input
// 	let variableError: ErrorWithCode | null = null

// 	// the function invoked by `this.error` inside of the variable function
// 	const setVariableError = (code: number, msg: string) => {
// 		// create an error
// 		variableError = new Error(msg) as ErrorWithCode
// 		variableError.code = code
// 		// return no variables to assign
// 		return null
// 	}

// 	// the context to invoke the variable function with
// 	const variableContext = {
// 		redirect: goTo,
// 		error: setVariableError,
// 	}

// 	// the function to call to reload the data while updating the internal stores
// 	const reload = (vars: _Input | undefined) => {
// 		// set the loading state
// 		loading.set(true)

// 		// fire the query
// 		return refetch(vars)
// 			.catch((err) => {
// 				error.set(err.message ? err : new Error(err))
// 			})
// 			.finally(() => {
// 				loading.set(false)
// 			})
// 	}

// 	$: {
// 		// clear any previous variable error
// 		variableError = null
// 		// compute the new variables
// 		variables = marshalInputs({
// 			artifact,
// 			config,
// 			input:
// 				variableFunction?.call(variableContext, {
// 					page: get(getPage()),
// 					session: get(getSession()),
// 					props: getProps(),
// 				}) || {},
// 		}) as _Input
// 	}

// 	// a component should fire the query and then write the result to the store
// 	$: {
// 		// remember if the data was loaded from cache
// 		let cached = false

// 		// if there was an error while computing variables
// 		if (variableError) {
// 			error.set(variableError)
// 		}
// 		// the artifact might have a defined cache policy we need to enforce
// 		else if (
// 			[
// 				CachePolicy.CacheOrNetwork,
// 				CachePolicy.CacheOnly,
// 				CachePolicy.CacheAndNetwork,
// 			].includes(artifact.policy!)
// 		) {
// 			const cachedValue = cache.read({ selection: artifact.selection, variables })

// 			// if there is something to write
// 			if (cachedValue.data) {
// 				writeData(
// 					{
// 						data: cachedValue.data as _Data,
// 						errors: [],
// 					},
// 					variables
// 				)
// 				cached = true
// 			}
// 			// nothing cached
// 			else {
// 				// load the query
// 				reload(variables)
// 			}
// 		}
// 		// there was no error while computing the variables
// 		else {
// 			// load the query
// 			reload(variables)
// 		}

// 		// if we loaded a cached value and we haven't sent the follow up
// 		if (cached && artifact.policy === CachePolicy.CacheAndNetwork) {
// 			// reload the query
// 			reload(variables)
// 		}
// 	}

// 	// return the handler to the user
// 	return {
// 		...queryHandler,
// 		refetch: reload,
// 		loading: { subscribe: loading.subscribe },
// 		error: { subscribe: error.subscribe },
// 	}
// }

type ErrorWithCode = Error & { code: number }
