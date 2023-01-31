import type { DocumentStore } from '$houdini/runtime/client'
import type { SubscriptionArtifact } from '$houdini/runtime/lib/types'
import { CompiledSubscriptionKind } from '$houdini/runtime/lib/types'
import type { GraphQLObject } from 'houdini'

import { initClient } from '../client'
import { BaseStore } from './base'

export class SubscriptionStore<_Data extends GraphQLObject, _Input extends {}> extends BaseStore<
	_Data,
	_Input,
	SubscriptionArtifact
> {
	kind = CompiledSubscriptionKind

	constructor({ artifact }: { artifact: SubscriptionArtifact }) {
		super({ artifact })
	}

	subscribe(...args: Parameters<DocumentStore<_Data, _Input>['subscribe']>) {
		return this.observer?.subscribe(...args)
	}

	async listen(variables?: _Input) {
		await initClient()
		this.observer.send({ variables })
	}
}
