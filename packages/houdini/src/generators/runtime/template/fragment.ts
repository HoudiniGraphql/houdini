// externals
import { readable, Readable } from 'svelte/store'
import { onMount } from 'svelte'
// locals
import { registerDocumentStore, unregisterDocumentStore } from './runtime'
import type { Fragment, GraphQLTagResult } from './types'
import { getVariables } from './context'

// fragment returns the requested data from the reference
export default function fragment<_Fragment extends Fragment<any>>(
	fragment: GraphQLTagResult,
	data: _Fragment
): Readable<_Fragment['shape']> {
	// make sure we got a query document
	if (fragment.kind !== 'HoudiniFragment') {
		throw new Error('getFragment can only take fragment documents')
	}

	// @ts-ignore: .__variables is added by the selector and hidden from the user's world
	const variables = getVariables()
	// wrap the result in a store we can use to keep this query up to date
	const value = readable(data, (set) => {
		// build up the store object
		const store = {
			loaded: false,
			name: fragment.name,
			updateValue: (newValue: _Fragment['shape']) => {
				// update the public store
				set(newValue)
				// keep the internal value up to date aswell
				store.currentValue = newValue
			},
			currentValue: data,
			variables: variables,
		}

		// when the component monuts
		onMount(() => {
			// register the updater for the query
			registerDocumentStore(store)
		})

		// the function used to clean up the store
		return () => {
			unregisterDocumentStore(store)
		}
	})

	return value
}
