// externals
import { Readable, writable } from 'svelte/store'
// locals
import {
	ConfigFile,
	executeQuery,
	HoudiniFetchContext,
	MutationResult,
	MutationStore,
} from '../lib'
import type { SubscriptionSpec, MutationArtifact } from '../lib'
import cache from '../cache'
import { marshalInputs, marshalSelection, unmarshalSelection } from '../lib/scalars'

export function mutationStore<_Data, _Input>({
	config,
	artifact,
}: {
	config: ConfigFile
	artifact: MutationArtifact
}): MutationStore<_Data, _Input> {
	const { subscribe, set, update } = writable<MutationResult<_Data, _Input>>({
		data: null as _Data | null,
		errors: null,
		isFetching: false,
		isOptimisticResponse: false,
		variables: null,
	})

	const mutate: MutationStore<_Data, _Input>['mutate'] = async ({
		variables,
		context,
		metadata,
		...mutationConfig
	}) => {
		let fetchContext: HoudiniFetchContext | { session: () => null } = context || {
			session: () => null,
		}

		update((c) => {
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
				selection: artifact.selection,
				// make sure that any scalar values get processed into something we can cache
				data: marshalSelection({
					config,
					selection: artifact.selection,
					data: optimisticResponse,
				})!,
				variables,
				layer: layer.id,
			})

			const storeData = {
				data: optimisticResponse,
				errors: null,
				isFetching: true,
				isOptimisticResponse: true,
				variables,
			}

			// update the store value
			set(storeData)
		}

		const newVariables = marshalInputs({
			input: variables,
			artifact,
			config,
		}) as _Input

		try {
			// trigger the mutation
			const { result } = await executeQuery({
				config,
				artifact,
				variables: newVariables,
				session: fetchContext.session?.(),
				cached: false,
				metadata,
			})

			if (result.errors && result.errors.length > 0) {
				update((s) => ({
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
				selection: artifact.selection,
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
				data: unmarshalSelection(config, artifact.selection, result.data) as _Data,
				errors: result.errors ?? null,
				isFetching: false,
				isOptimisticResponse: false,
				variables: newVariables,
			}

			// update the store value
			set(storeData)

			// return the value to the caller
			return storeData
		} catch (error) {
			update((s) => ({
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

	return {
		name: artifact.name,
		subscribe,
		mutate,
	}
}
