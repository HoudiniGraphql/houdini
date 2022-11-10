import { getCache } from '$houdini/runtime'
import { executeQuery } from '$houdini/runtime/lib/network'
import { marshalInputs, marshalSelection, unmarshalSelection } from '$houdini/runtime/lib/scalars'
import type { SubscriptionSpec, MutationArtifact } from '$houdini/runtime/lib/types'
import { GraphQLObject } from '$houdini/runtime/lib/types'
import { Readable } from 'svelte/store'
import { Writable, writable } from 'svelte/store'

import { getCurrentClient } from '../network'
import { getSession } from '../session'
import { BaseStore } from './store'

export class MutationStore<
	_Data extends GraphQLObject,
	_Input extends {},
	_Optimistic extends GraphQLObject
> extends BaseStore {
	artifact: MutationArtifact
	kind = 'HoudiniMutation' as const

	private store: Writable<MutationResult<_Data, _Input>>

	protected setFetching(isFetching: boolean) {
		this.store?.update((s) => ({ ...s, isFetching }))
	}

	constructor({ artifact }: { artifact: MutationArtifact }) {
		super()
		this.artifact = artifact
		this.store = writable(this.initialState)
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
		const cache = getCache()
		const config = await this.getConfig()

		this.store.update((c) => {
			return { ...c, isFetching: true }
		})

		// treat a mutation like it has an optimistic layer regardless of
		// whether there actually _is_ one. This ensures that a query which fires
		// after this mutation has been sent will overwrite any return values from the mutation
		//
		// as far as I can tell, this is an arbitrary decision but it does give a
		// well-defined ordering to a subtle situation so that seems like a win
		//
		const layer = cache._internal_unstable.storage.createLayer(true)

		// if there is an optimistic response then we need to write the value immediately
		const optimisticResponse = mutationConfig?.optimisticResponse
		// hold onto the list of subscribers that we updated because of the optimistic response
		// and make sure they are included in the final set of subscribers to notify
		let toNotify: SubscriptionSpec[] = []
		if (optimisticResponse) {
			toNotify = cache.write({
				selection: this.artifact.selection,
				// make sure that any scalar values get processed into something we can cache
				data: (await marshalSelection({
					selection: this.artifact.selection,
					data: optimisticResponse,
				}))!,
				variables,
				layer: layer.id,
			})
		}

		const newVariables = (await marshalInputs({
			input: variables,
			artifact: this.artifact,
		})) as _Input

		try {
			// trigger the mutation
			const { result } = await executeQuery({
				client: await getCurrentClient(),
				config,
				artifact: this.artifact,
				variables: newVariables,
				session: await getSession(),
				setFetching: (val) => this.setFetching(val),
				cached: false,
				metadata,
				fetch,
			})

			if (result.errors && result.errors.length > 0) {
				this.store.update((s) => ({
					...s,
					errors: result.errors,
					isFetching: false,
					isOptimisticResponse: false,
					data: result.data,
					variables: (newVariables || {}) as _Input,
				}))
				throw result.errors
			}

			// clear the layer holding any mutation results
			layer.clear()

			// write the result of the mutation to the cache
			cache.write({
				selection: this.artifact.selection,
				data: result.data,
				variables: newVariables,
				// write to the mutation's layer
				layer: layer.id,
				// notify any subscribers that we updated with the optimistic response
				// in order to address situations where the optimistic update was wrong
				notifySubscribers: toNotify,
				// make sure that we notify subscribers for any values that we overwrite
				// in order to address any race conditions when comparing the previous value
				forceNotify: true,
			})

			// merge the layer back into the cache
			cache._internal_unstable.storage.resolveLayer(layer.id)

			// prepare store data
			const storeData: MutationResult<_Data, _Input> = {
				data: unmarshalSelection(config, this.artifact.selection, result.data) as _Data,
				errors: result.errors ?? null,
				isFetching: false,
				isOptimisticResponse: false,
				variables: newVariables,
			}

			// update the store value
			this.store.set(storeData)

			// return the value to the caller
			return storeData.data ?? ({} as _Data)
		} catch (error) {
			this.store.update((s) => ({
				...s,
				errors: error as { message: string }[],
				isFetching: false,
				isOptimisticResponse: false,
				data: null,
				variables: newVariables,
			}))

			// if the mutation failed, roll the layer back and delete it
			layer.clear()
			cache._internal_unstable.storage.resolveLayer(layer.id)

			// bubble the mutation error up to the caller
			throw error
		}
	}

	subscribe(...args: Parameters<Readable<MutationResult<_Data, _Input>>['subscribe']>) {
		// use it's value
		return this.store.subscribe(...args)
	}

	private get initialState() {
		return {
			data: null as _Data | null,
			errors: null,
			isFetching: false,
			isOptimisticResponse: false,
			variables: null,
		}
	}
}

export type MutationConfig<_Result, _Input, _Optimistic> = {
	optimisticResponse?: _Optimistic
}

export type MutationResult<_Data, _Input> = {
	data: _Data | null
	errors: { message: string }[] | null
	isFetching: boolean
	isOptimisticResponse: boolean
	variables: _Input | null
}
