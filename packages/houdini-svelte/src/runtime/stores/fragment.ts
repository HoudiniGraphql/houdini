import cache from '$houdini/runtime/cache'
import type {
	GraphQLObject,
	FragmentArtifact,
	HoudiniFetchContext,
} from '$houdini/runtime/lib/types'
import { CompiledFragmentKind, fragmentKey } from '$houdini/runtime/lib/types'
import { derived } from 'svelte/store'

import { getClient } from '../client'
import type { FragmentStoreInstance } from '../types'

// a fragment store exists in multiple places in a given application so we
// can't just return a store directly, the user has to load the version of the
// fragment store for the object the store has been mixed into
export class FragmentStore<_Data extends GraphQLObject, _Input = {}> {
	artifact: FragmentArtifact
	name: string
	kind = CompiledFragmentKind

	protected context: HoudiniFetchContext | null = null

	constructor({ artifact, storeName }: { artifact: FragmentArtifact; storeName: string }) {
		this.artifact = artifact
		this.name = storeName
	}

	get(initialValue: _Data | null): FragmentStoreInstance<_Data | null> {
		// we have to compute the id of the parent
		const parentID = cache._internal_unstable.id(this.artifact.rootType, initialValue)

		// @ts-expect-error
		// the variables for the fragment live on the initial value's $fragment key
		const variables = initialValue?.[fragmentKey]?.[this.artifact.name]

		// on the client, we want to ensure that we apply masking to the initial value by
		// loading the value from cache
		if (initialValue && parentID && typeof globalThis.window !== 'undefined') {
			initialValue = cache.read({
				selection: this.artifact.selection,
				parent: parentID,
				variables,
			}).data as _Data
		}

		// build up a document store that we will use to subscribe the fragment to cache updates
		const store = getClient().observe<_Data, {}>({ artifact: this.artifact, initialValue })

		if (variables && parentID) {
			store.send({ variables, setup: true, stuff: { parentID } })
		}

		return {
			kind: CompiledFragmentKind,
			subscribe: derived([store], ([$store]) => $store?.data).subscribe,
			update: (val: _Data | null) => store?.set({ ...store.state, data: val }),
		}
	}
}
