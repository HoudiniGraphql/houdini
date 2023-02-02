import type { DocumentStore } from '$houdini/runtime/client'
import type { MutationArtifact, GraphQLObject, QueryResult } from '$houdini/runtime/lib/types'
import type { RequestEvent } from '@sveltejs/kit'

import { initClient } from '../client'
import { BaseStore } from './base'
import { fetchParams } from './query'

export class MutationStore<
	_Data extends GraphQLObject,
	_Input extends {},
	_Optimistic extends GraphQLObject
> extends BaseStore<_Data, _Input, MutationArtifact> {
	kind = 'HoudiniMutation' as const

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
	): Promise<QueryResult<_Data, _Input>> {
		await initClient()

		const { context } = await fetchParams(this.artifact, this.artifact.name, {
			fetch,
			metadata,
			event,
		})

		return await this.observer.send({
			variables,
			fetch: context.fetch,
			metadata,
			session: context.session,
			stuff: {
				...mutationConfig,
			},
		})
	}

	subscribe(...args: Parameters<DocumentStore<_Data, _Input>['subscribe']>) {
		// use it's value
		return this.observer.subscribe(...args)
	}
}

export type MutationConfig<_Result, _Input, _Optimistic> = {
	optimisticResponse?: _Optimistic
}
