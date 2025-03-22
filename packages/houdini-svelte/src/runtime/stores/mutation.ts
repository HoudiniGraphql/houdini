import type {
	MutationArtifact,
	GraphQLObject,
	QueryResult,
	GraphQLVariables,
} from '$houdini/runtime/lib/types'
import type { RequestEvent } from '@sveltejs/kit'

import { BaseStore } from './base'
import { fetchParams } from './query'

export class MutationStore<
	_Data extends GraphQLObject,
	_Input extends GraphQLVariables,
	_Optimistic extends GraphQLObject
> extends BaseStore<_Data, _Input, MutationArtifact> {
	kind = 'HoudiniMutation' as const

	async mutate(
		variables: _Input,
		{
			metadata,
			fetch,
			event,
			abortController,
			...mutationConfig
		}: {
			// @ts-ignore
			metadata?: App.Metadata
			fetch?: typeof globalThis.fetch
			event?: RequestEvent
		} & MutationConfig<_Data, _Input, _Optimistic> = {}
	): Promise<QueryResult<_Data, _Input>> {
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
			abortController,
			stuff: {
				...mutationConfig,
			},
		})
	}
}

export type MutationConfig<_Result, _Input, _Optimistic> = {
	optimisticResponse?: _Optimistic
	abortController?: AbortController
}
