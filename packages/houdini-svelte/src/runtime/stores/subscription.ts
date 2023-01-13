import { DocumentObserver, getCache } from '$houdini/runtime'
import { deepEquals } from '$houdini/runtime/lib/deepEquals'
import { marshalInputs, unmarshalSelection } from '$houdini/runtime/lib/scalars'
import { CompiledSubscriptionKind, SubscriptionArtifact } from '$houdini/runtime/lib/types'
import { GraphQLObject } from 'houdini'
import { writable, Writable } from 'svelte/store'

import { isBrowser } from '../adapter'
import { getCurrentClient } from '../network'

export class SubscriptionStore<_Data extends GraphQLObject, _Input extends {}> {
	artifact: SubscriptionArtifact
	kind = CompiledSubscriptionKind

	private store: DocumentObserver<_Data, _Input>

	constructor({ artifact }: { artifact: SubscriptionArtifact }) {
		this.artifact = artifact
		this.store = getCurrentClient().observe({ artifact: this.artifact })
	}

	subscribe(...args: Parameters<DocumentObserver<_Data, _Input>['subscribe']>) {
		return this.store?.subscribe(...args)
	}

	async listen(variables?: _Input) {
		this.store.send({ variables })
	}
}
