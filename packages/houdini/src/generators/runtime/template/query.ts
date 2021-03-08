// externals
import { readable, Readable } from 'svelte/store'
import { onMount } from 'svelte'
// locals
import { Operation, GraphQLTagResult, SubscriptionSpec } from './types'
import cache from './cache'
import { setVariables } from './context'

export default function query<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): QueryResponse<Readable<_Query['result']>, _Query['input']> {
	// make sure we got a query document
	if (document.kind !== 'HoudiniQuery') {
		throw new Error('getQuery can only take query operations')
	}

	// emebed the variables in the components context
	setVariables(document.variables)

	// dry the reference to the initial value
	const initialValue = document.initialValue.data

	// the last known variables
	let variables = document.variables

	// pull out the writer for internal use
	let subscriptionSpec: SubscriptionSpec | null = null

	// define the store we will hold the data
	const data = readable(initialValue, (set) => {
		// when the component mounts
		onMount(() => {
			// build the subscription spec
			subscriptionSpec = {
				rootType: document.artifact.rootType,
				selection: document.artifact.selection,
				set,
			}

			// once we've mounted
			cache.write(document.artifact.response, initialValue, variables)

			// stay up to date
			cache.subscribe(subscriptionSpec, variables)
		})

		// the function used to clean up the store
		return () => {
			subscriptionSpec = null
			cache.unsubscribe(
				{
					rootType: document.artifact.rootType,
					selection: document.artifact.selection,
					set,
				},
				variables
			)
		}
	})

	return {
		data,
		// used primarily by the preprocessor to keep
		writeData(newData: _Query['result'], newVariables: _Query['input']) {
			// hold onto the new variables
			variables = newVariables

			// write the data we received
			cache.write(document.artifact.response, newData.data, newVariables)

			// if we are still subscribing to the store
			if (subscriptionSpec) {
				// stay up to date
				cache.subscribe(subscriptionSpec, newVariables)
			}
		},
	}
}

// we need to wrap the response from a query in something that we can
// use as a proxy to the query for refetches, writing to the cache, etc
type QueryResponse<_Data, _Input> = {
	data: _Data
	writeData: (data: _Data, variables: _Input) => void
}

// we need something we can replace the call to query that the user invokes
// it justs needs to pass through since we'll give it a reference to a hoisted query
export const getQuery = <T>(arg: T): T => arg
