import type {
	GraphQLObject,
	FragmentArtifact,
	HoudiniFetchContext,
	GraphQLVariables,
} from '$houdini/runtime/lib/types'
import { CompiledFragmentKind, fragmentKey } from '$houdini/runtime/lib/types'
import cache from 'houdini/src/runtime/cache'
import { current_config } from 'houdini/src/runtime/lib/config'
import { marshalInputs } from 'houdini/src/runtime/lib/scalars'
import { derived } from 'svelte/store'

import { isBrowser } from '../adapter'
import type { FragmentStoreInstance } from '../types'
import { BaseStore } from './base'

// a fragment store exists in multiple places in a given application so we
// can't just return a store directly, the user has to load the version of the
// fragment store for the object the store has been mixed into
export class FragmentStore<
	_Data extends GraphQLObject,
	_ReferenceType extends {},
	_Input extends GraphQLVariables = GraphQLVariables
> {
	artifact: FragmentArtifact
	name: string
	kind = CompiledFragmentKind

	protected context: HoudiniFetchContext | null = null

	constructor({ artifact, storeName }: { artifact: FragmentArtifact; storeName: string }) {
		this.artifact = artifact
		this.name = storeName
	}

	get(
		initialValue: _Data | { [fragmentKey]: _ReferenceType } | null
	): FragmentStoreInstance<_Data | null, _Input> & { initialValue: _Data | null } {
		const { variables, parent } =
			// @ts-expect-error: typescript can't guarantee that the fragment key is defined
			// but if its not, then the fragment wasn't mixed into the right thing
			// the variables for the fragment live on the initial value's $fragment key
			initialValue?.[fragmentKey]?.values?.[this.artifact.name] ?? {}
		// @ts-expect-error: see above.
		const { loading } = initialValue?.[fragmentKey] ?? {}
		if (
			!loading &&
			initialValue &&
			fragmentKey in initialValue &&
			(!variables || !parent) &&
			isBrowser
		) {
			console.warn(
				`⚠️ Parent does not contain the information for this fragment. Something is wrong.
Please ensure that you have passed a record that has ${this.artifact.name} mixed into it.`
			)
		}

		// if we got this far then we are safe to use the fields on the object
		let data = initialValue as _Data | null

		// on the client, we want to ensure that we apply masking to the initial value by
		// loading the value from cache
		if (loading || (initialValue && parent && isBrowser)) {
			data = cache.read({
				selection: this.artifact.selection,
				parent,
				variables,
				loading,
			}).data as _Data
		}

		// build up a document store that we will use to subscribe the fragment to cache updates
		const store = new BaseStore<_Data, _Input>({
			artifact: this.artifact,
			initialValue: data,
		})
		if (!loading && parent) {
			store.observer.send({ variables, setup: true, stuff: { parentID: parent } })
		}

		return {
			initialValue: data,
			variables: marshalInputs({
				artifact: this.artifact,
				input: variables,
				config: current_config(),
				rootType: this.artifact.rootType,
			}) as _Input,
			kind: CompiledFragmentKind,
			subscribe: derived([store], ([$store]) => $store.data).subscribe,
		}
	}
}
