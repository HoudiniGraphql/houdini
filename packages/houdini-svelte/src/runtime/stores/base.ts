import type { DocumentStore, ObserveParams, HoudiniClient } from '$houdini/runtime/client'
import type { GraphQLObject, DocumentArtifact } from '$houdini/runtime/lib/types'

import { getClient } from '../client'

export class BaseStore<
	_Data extends GraphQLObject,
	_Input extends {},
	_Artifact extends DocumentArtifact = DocumentArtifact
> {
	// the underlying artifact
	#params: ObserveParams<_Data, _Artifact>

	constructor(params: ObserveParams<_Data, _Artifact>) {
		this.#params = params
	}

	get artifact() {
		return this.#params.artifact
	}

	#observer: DocumentStore<_Data, _Input> | null = null
	protected get observer(): DocumentStore<_Data, _Input> {
		if (this.#observer) {
			return this.#observer
		}

		this.#observer = getClient().observe<_Data, _Input>(this.#params)

		return this.#observer
	}
}
