import type { SubscriptionArtifact } from '$houdini/runtime/lib/types'
import { CompiledSubscriptionKind } from '$houdini/runtime/lib/types'
import type { GraphQLObject } from 'houdini'

import { initClient } from '../client'
import { getSession } from '../session'
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

	async listen(variables?: _Input, args?: { metadata: App.Metadata }) {
		await initClient()
		this.observer.send({
			variables,
			session: await getSession(),
			metadata: args?.metadata,
		})
	}

	async unlisten() {
		await initClient()
		await this.observer.cleanup()
	}
}
