import { DocumentObserver } from '$houdini/runtime/client/documentObserver'
import { CompiledSubscriptionKind, SubscriptionArtifact } from '$houdini/runtime/lib/types'
import { GraphQLObject } from 'houdini'

import { getClient } from '../client'

export class SubscriptionStore<_Data extends GraphQLObject, _Input extends {}> {
	artifact: SubscriptionArtifact
	kind = CompiledSubscriptionKind

	private store: DocumentObserver<_Data, _Input>

	constructor({ artifact }: { artifact: SubscriptionArtifact }) {
		this.artifact = artifact
		this.store = getClient().observe({ artifact: this.artifact })
	}

	subscribe(...args: Parameters<DocumentObserver<_Data, _Input>['subscribe']>) {
		return this.store?.subscribe(...args)
	}

	async listen(variables?: _Input) {
		this.store.send({ variables })
	}
}
