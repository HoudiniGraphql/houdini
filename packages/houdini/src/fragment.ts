// externals
import { GraphQLTagResult } from 'houdini-preprocess'
import { CompiledFragmentKind } from 'houdini-compiler'
import { readable, Readable } from 'svelte/store'
import { onMount } from 'svelte'
// locals
import { registerDocumentStore, unregisterDocumentStore } from './runtime'
import type { Fragment } from './types'

// fragment returns the requested data from the reference
export default function fragment<_Fragment extends Fragment<any>>(
	fragment: GraphQLTagResult,
	reference: _Fragment
): Readable<_Fragment['shape']> {
	// make sure we got a query document
	if (fragment.kind !== CompiledFragmentKind) {
		throw new Error('getFragment can only take fragment documents')
	}

	// wrap the result in a store we can use to keep this query up to date
	const value = readable(fragment.applyMask(reference), (set) => {
		// build up the store object
		const store = {
			name: fragment.name,
			set: (val: _Fragment['shape']) => {
				console.log({
					apply: fragment.applyMask,
					valOld: val,
					val: fragment.applyMask(val),
				})
				set(fragment.applyMask(val))
			},
			currentValue: {},
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
