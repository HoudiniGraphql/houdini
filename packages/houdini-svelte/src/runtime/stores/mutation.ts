import type { DocumentObserver } from '$houdini/runtime/client'
import type { MutationArtifact } from '$houdini/runtime/lib/types'
import type { GraphQLObject } from '$houdini/runtime/lib/types'

import { getClient } from '../client'
import { getSession } from '../session'

export class MutationStore<
	_Data extends GraphQLObject,
	_Input extends {},
	_Optimistic extends GraphQLObject
> {
	artifact: MutationArtifact
	kind = 'HoudiniMutation' as const

	private store: DocumentObserver<_Data, _Input>

	constructor({ artifact }: { artifact: MutationArtifact }) {
		this.artifact = artifact
		this.store = getClient().observe({ artifact: this.artifact })
	}

	async mutate(
		variables: _Input,
		{
			metadata,
			fetch,
			...mutationConfig
		}: {
			// @ts-ignore
			metadata?: App.Metadata
			fetch?: typeof globalThis.fetch
		} & MutationConfig<_Data, _Input, _Optimistic> = {}
	): Promise<_Data> {
		return (
			await this.store.send({
				variables,
				fetch,
				metadata,
				session: await getSession(),
				stuff: {
					...mutationConfig,
				},
			})
		).data!
	}

	subscribe(...args: Parameters<DocumentObserver<_Data, _Input>['subscribe']>) {
		// use it's value
		return this.store.subscribe(...args)
	}
}

export type MutationConfig<_Result, _Input, _Optimistic> = {
	optimisticResponse?: _Optimistic
}
