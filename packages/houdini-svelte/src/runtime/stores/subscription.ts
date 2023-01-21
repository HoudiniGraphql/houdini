import type { DocumentStore } from '$houdini/runtime/client'
import type { SubscriptionArtifact } from '$houdini/runtime/lib/types'
import { CompiledSubscriptionKind } from '$houdini/runtime/lib/types'
import type { GraphQLObject } from 'houdini'

import { getClient } from '../client'

export class SubscriptionStore<_Data extends GraphQLObject, _Input extends {}> {
	artifact: SubscriptionArtifact
	kind = CompiledSubscriptionKind

	private store: DocumentStore<_Data, _Input>

	constructor({ artifact }: { artifact: SubscriptionArtifact }) {
		this.artifact = artifact
		this.store = getClient().observe({ artifact: this.artifact })
	}

	subscribe(...args: Parameters<DocumentStore<_Data, _Input>['subscribe']>) {
		return this.store?.subscribe(...args)
	}

	async listen(variables?: _Input) {
		this.store.send({ variables })
	}
}
