import type { DocumentStore } from '$houdini/runtime/client'
import { FetchContext } from '$houdini/runtime/client/plugins'
import type { MutationArtifact } from '$houdini/runtime/lib/types'
import type { GraphQLObject } from '$houdini/runtime/lib/types'
import type { RequestEvent } from '@sveltejs/kit'

import { getClient } from '../client'
import { fetchParams } from './query'

export class MutationStore<
	_Data extends GraphQLObject,
	_Input extends {},
	_Optimistic extends GraphQLObject
> {
	artifact: MutationArtifact
	kind = 'HoudiniMutation' as const

	private store: DocumentStore<_Data, _Input>

	constructor({ artifact }: { artifact: MutationArtifact }) {
		this.artifact = artifact
		this.store = getClient().observe({ artifact: this.artifact })
	}

	async mutate(
		variables: _Input,
		{
			metadata,
			fetch,
			event,
			...mutationConfig
		}: {
			// @ts-ignore
			metadata?: App.Metadata
			fetch?: typeof globalThis.fetch
			event?: RequestEvent
		} & MutationConfig<_Data, _Input, _Optimistic> = {}
	): Promise<_Data> {
		const { context } = await fetchParams(this.artifact, this.artifact.name, {
			fetch,
			metadata,
			event,
		})

		return (
			await this.store.send({
				variables,
				fetch: context.fetch,
				metadata,
				session: context.session,
				stuff: {
					...mutationConfig,
				},
			})
		).data!
	}

	subscribe(...args: Parameters<DocumentStore<_Data, _Input>['subscribe']>) {
		// use it's value
		return this.store.subscribe(...args)
	}
}

export type MutationConfig<_Result, _Input, _Optimistic> = {
	optimisticResponse?: _Optimistic
}
