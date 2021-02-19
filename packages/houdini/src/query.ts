// externals
import { GraphQLTagResult } from 'houdini-preprocess'
import { CompiledQueryKind } from 'houdini-compiler'
import { readable, Readable } from 'svelte/store'
import { onMount } from 'svelte'
// locals
import { registerDocumentStore, unregisterDocumentStore } from './runtime'
import { Operation } from './types'

export default function query<_Query extends Operation<any, any>>(
	document: GraphQLTagResult
): Readable<_Query['result']> {
	// make sure we got a query document
	if (document.kind !== CompiledQueryKind) {
		throw new Error('getQuery can only take query operations')
	}

	// wrap the result in a store we can use to keep this query up to date
	const value = readable(
		document.processResult(document.initialValue.data, document.variables),
		(set) => {
			// build up the store object
			const store = {
				name: document.name,
				updateValue: (val: _Query['result']) => set(document.processResult(val, document.variables)),
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
		}
	)

	return value
}
