// externals
import { GraphQLTagResult } from 'houdini-preprocess'
import { CompiledQueryKind } from 'houdini-compiler'
import { readable, Readable } from 'svelte/store'
import { onMount } from 'svelte'
// locals
import { registerDocumentStore, unregisterDocumentStore } from './runtime'

export default function query(
	document: GraphQLTagResult,
	variables: { [name: string]: unknown }
): Readable<unknown> {
	// make sure we got a query document
	if (document.kind !== CompiledQueryKind) {
		throw new Error('getQuery can only take query operations')
	}

	// wrap the result in a store we can use to keep this query up to date
	const value = readable(document.processResult(document.initialValue.data), (set) => {
		// build up the store object
		const store = {
			name: document.name,
			set,
			currentValue: {},
		}

		// when the component monuts
		onMount(() => {
			// register the updater for the query
			registerDocumentStore(store)

			// keep the stores' values in sync
			value.subscribe((val) => {
				store.currentValue = val
			})
		})

		// the function used to clean up the store
		return () => {
			unregisterDocumentStore(store)
		}
	})

	return value
}
