import type {
	GraphQLObject,
	FragmentArtifact,
	HoudiniFetchContext,
} from '$houdini/runtime/lib/types'
import { CompiledFragmentKind } from '$houdini/runtime/lib/types'
import { writable } from 'svelte/store'
import type { Readable, Writable } from 'svelte/store'

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

	get(initialValue: _Data): FragmentStoreInstance<_Data> | FragmentStoreInstance<_Data>
	get(
		initialValue: _Data | null
	): FragmentStoreInstance<_Data> | FragmentStoreInstance<_Data | null>
	get(
		initialValue: _Data | null
	): FragmentStoreInstance<_Data> | FragmentStoreInstance<_Data | null> {
		// at the moment a fragment store doesn't really do anything
		// but we're going to keep it wrapped in a store so we can eventually
		// optimize the updates
		let store = writable(initialValue) as Writable<_Data>

		return {
			kind: CompiledFragmentKind,
			subscribe: (...args: Parameters<Readable<_Data>['subscribe']>) => {
				return store.subscribe(...args)
			},
			update: (val: _Data) => store?.set(val),
		}
	}
}

export type FragmentStoreInstance<_Data> = Readable<_Data> & {
	kind: typeof CompiledFragmentKind
	update: Writable<_Data>['set']
}
