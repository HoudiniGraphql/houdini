import type {
	GraphQLObject,
	FragmentArtifact,
	HoudiniFetchContext,
} from '$houdini/runtime/lib/types'
import { CompiledFragmentKind } from '$houdini/runtime/lib/types'
import { Readable } from 'svelte/store'
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
		// at the moment a fragment store doesn't really do anything
		// but we're going to keep it wrapped in a store so we can eventually
		// optimize the updates
		const store = getClient().observe<_Data, {}>({ artifact: this.artifact, initialValue })
		// the variables for the fragment live on the initial value's $fragment key
		console.group(initialValue)

		return {
			kind: CompiledFragmentKind,
			subscribe: derived([store], ([$store]) => $store?.data).subscribe,
			update: (val: _Data | null) => store?.set({ ...store.state, data: val }),
		}
	}
}
