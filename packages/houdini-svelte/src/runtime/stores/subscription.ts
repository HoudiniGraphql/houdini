import type {
	GraphQLVariables,
	QueryResult,
	SubscriptionArtifact,
} from '$houdini/runtime/lib/types'
import { CompiledSubscriptionKind } from '$houdini/runtime/lib/types'
import type { GraphQLObject } from 'houdini'
import { derived, writable, type Subscriber, type Writable } from 'svelte/store'

import { getSession } from '../session'
import { BaseStore } from './base'

export class SubscriptionStore<
	_Data extends GraphQLObject,
	_Input extends GraphQLVariables
> extends BaseStore<_Data, _Input, SubscriptionArtifact> {
	kind = CompiledSubscriptionKind
	fetchingStore: Writable<boolean>

	constructor({ artifact }: { artifact: SubscriptionArtifact }) {
		super({ artifact })
		this.fetchingStore = writable(false)
	}

	async listen(variables?: _Input, args?: { metadata: App.Metadata }) {
		this.fetchingStore.set(true)
		this.observer.send({
			variables,
			session: await getSession(),
			metadata: args?.metadata,
		})
	}

	async unlisten() {
		this.fetchingStore.set(false)
		await this.observer.cleanup()
	}

	subscribe(
		run: Subscriber<QueryResult<_Data, _Input>>,
		invalidate?: ((value?: QueryResult<_Data, _Input> | undefined) => void) | undefined
	): () => void {
		// add the local fetching store to the default behavior
		return derived(
			[{ subscribe: super.subscribe.bind(this) }, this.fetchingStore],
			([$parent, $fetching]) => ({
				...$parent,
				fetching: $fetching,
			})
		).subscribe(run, invalidate)
	}
}
