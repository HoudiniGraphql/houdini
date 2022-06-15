// externals
import { derived, get, Readable, writable } from 'svelte/store'
// locals
import { marshalInputs } from '../lib/scalars'
import {
	GraphQLTagResult,
	Operation,
	QueryResult,
	CachePolicy,
	TaggedGraphqlQuery,
} from '../lib/types'
import { getPage, getSession, goTo } from '../adapter'
import { wrapPaginationStore, PaginatedDocumentHandlers } from '../lib/pagination'
import { getHoudiniContext } from '../lib/context'

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
	const errors = derived(document.store, ($store) => $store.errors)

	// load the current houdini context
	const context = getHoudiniContext()

	return {
		...document.store,
		data,
		refetch: (variables?: _Query['input'], config?: RefetchConfig) => {
			return document.store.load({
				context,
				variables,
				policy: CachePolicy.NetworkOnly,
				...config,
			})
		},
		errors,
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
	refetch: (input?: _Input, config?: RefetchConfig) => Promise<QueryResult<_Data, _Input>>
	loading: Readable<boolean>
	partial: Readable<boolean>
	errors: Readable<{ message: string }[] | null>
}

type RefetchConfig = {
	policy?: CachePolicy
}

// perform the necessary logic for a component query to function
function componentQuery<_Query extends Operation<any, any>>(
	document: TaggedGraphqlQuery
): {
	error: Readable<{ message: string }[] | null>
} {
	// compute the variables for the request
	let variables: _Query['input']
	let variableError: Error[] | null = null

	// we need to augment the error state
	const localError = writable<{ message: string }[] | null>(null)
	const error = derived(
		[localError, document.store],
		([$localError, $store]) => $localError || $store.errors
	)

	// the function invoked by `this.error` inside of the variable function
	const setVariableError = (code: number, msg: string) => {
		// create an error
		variableError = [new Error(msg)]
		// return no variables to assign
		return null
	}

	// the context to invoke the variable function with
	const variableContext = {
		redirect: goTo,
		error: setVariableError,
	}

	const session = getSession()
	const page = getPage()

	$: {
		// clear any previous variable error
		variableError = null
		// compute the new variables
		variables = marshalInputs({
			artifact: document.artifact,
			config: document.config,
			input:
				document.variableFunction?.call(variableContext, {
					page,
					session: session ? get(session) : null,
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
		document.store.load(variables)
	}

	return {
		error,
	}
}

type ErrorWithCode = Error & { code: number }

export function paginatedQuery<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): QueryResponse<_Query['result'], _Query['input']> &
	PaginatedDocumentHandlers<_Query['result'], _Query['input']> {
	// TODO: fix type checking paginated
	// @ts-ignore: the query store will only include the methods when it needs to
	// and the userland type checking happens as part of the query type generation
	return wrapPaginationStore(query(document))
}
