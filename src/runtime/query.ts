// externals
import { derived, get, Readable, writable } from 'svelte/store'
import { marshalInputs } from './scalars'
// locals
import {
	GraphQLTagResult,
	Operation,
	QueryResult,
	QueryStoreParams,
	TaggedGraphqlQuery,
} from './types'
// @ts-ignore: this file will get generated and does not exist in the source code
import { getPage, getSession, goTo } from './adapter.mjs'

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

	return {
		data,
		refetch: document.store.query,
		error,
		loading,
		partial,
		// if the document was mounted in a non-route component, we need to do special things
		...(document.component ? componentQuery<_Query>(document) : {}),
	}
}

// we need to wrap the response from a query in something that we can
// use as a proxy to the query for refetches, writing to the cache, etc
export type QueryResponse<_Data, _Input> = {
	data: Readable<_Data>
	refetch: (newVariables?: QueryStoreParams<_Input>) => Promise<QueryResult<_Data>>
	loading: Readable<boolean>
	partial: Readable<boolean>
	error: Readable<Error | null>
}

// perform the necessary logic for a component query to function
function componentQuery<_Query extends Operation<any, any>>(
	document: TaggedGraphqlQuery
): {
	error: Readable<Error | null>
} {
	// compute the variables for the request
	let variables: _Query['input']
	let variableError: ErrorWithCode | null = null

	// we need to augment the error state
	const localError = writable<Error | null>(null)
	const error = derived(
		[localError, document.store],
		([$localError, $store]) => $localError || $store.error
	)

	// the function invoked by `this.error` inside of the variable function
	const setVariableError = (code: number, msg: string) => {
		// create an error
		variableError = new Error(msg) as ErrorWithCode
		variableError.code = code
		// return no variables to assign
		return null
	}

	// the context to invoke the variable function with
	const variableContext = {
		redirect: goTo,
		error: setVariableError,
	}

	$: {
		// clear any previous variable error
		variableError = null
		// compute the new variables
		variables = marshalInputs({
			artifact: document.artifact,
			config: document.config,
			input:
				document.variableFunction?.call(variableContext, {
					page: get(getPage()),
					session: get(getSession()),
					props: document.getProps?.(),
				}) || {},
		}) as _Query['input']
	}

	// a component should fire the query and then write the result to the store
	$: {
		// if there was an error while computing variables
		if (variableError) {
			localError.set(variableError)
		}

		// load the data with the new variables
		document.store.query(variables)
	}

	return {
		error,
	}
}

type ErrorWithCode = Error & { code: number }
