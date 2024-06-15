import type { Cache } from '../../cache/cache'
import { getFieldsForType } from '../../lib'
import { marshalSelection } from '../../lib/scalars'
import type { GraphQLObject, SubscriptionSpec } from '../../lib/types'
import { ArtifactKind, SubscriptionSelection } from '../../lib/types'
import { documentPlugin } from '../utils'

// a place to store all of the optimistic keys that are pending
const UsedKeys = new Set<string>()

export const mutation = (cache: Cache) =>
	documentPlugin(ArtifactKind.Mutation, () => {
		return {
			async start(ctx, { next, marshalVariables }) {
				// treat a mutation like it has an optimistic layer regardless of
				// whether there actually _is_ one. This ensures that a query which fires
				// after this mutation has been sent will overwrite any return values from the mutation
				//
				// as far as I can tell, this is an arbitrary decision but it does give a
				// well-defined ordering to a subtle situation so that seems like a win
				const layerOptimistic = cache._internal_unstable.storage.createLayer(true)

				// the optimistic response gets passed in the context's stuff bag
				const optimisticResponse = ctx.stuff.optimisticResponse

				// if there is an optimistic response then we need to write the value immediately

				// hold onto the list of subscribers that we updated because of the optimistic response
				// and make sure they are included in the final set of subscribers to notify
				let toNotify: SubscriptionSpec[] = []
				if (optimisticResponse) {
					// if the mutation has optimistic keys embedded in the response, we need to
					// add them to the response and register the values in our global state (only on the client)
					if (
						ctx.artifact.kind === ArtifactKind.Mutation &&
						ctx.artifact.optimisticKeys
					) {
						injectOptimisticKeys(ctx.artifact.selection, optimisticResponse, UsedKeys)
					}

					toNotify = cache.write({
						selection: ctx.artifact.selection,
						// make sure that any scalar values get processed into something we can cache
						data: (await marshalSelection({
							selection: ctx.artifact.selection,
							data: optimisticResponse,
						}))!,
						variables: marshalVariables(ctx),
						layer: layerOptimistic.id,
					})
				}

				// update cacheParams
				ctx.cacheParams = {
					...ctx.cacheParams,
					// write to the mutation's layer
					layer: layerOptimistic,
					// notify any subscribers that we updated with the optimistic response
					// in order to address situations where the optimistic update was wrong
					notifySubscribers: toNotify,
					// make sure that we notify subscribers for any values that we compare
					// in order to address any race conditions when comparing the previous value
					forceNotify: true,
				}

				// make sure we write to the correct layer in the cache
				next(ctx)
			},
			afterNetwork(ctx, { resolve }) {
				// before the cache sees the data, we need to clear the layer
				if (ctx.cacheParams?.layer) {
					cache.clearLayer(ctx.cacheParams.layer.id)
				}

				// we're done
				resolve(ctx)
			},
			end(ctx, { resolve, value }) {
				const hasErrors = value.errors && value.errors.length > 0
				// if there are errors, we need to clear the layer before resolving
				if (hasErrors) {
					// if the mutation failed, roll the layer back and delete it
					if (ctx.cacheParams?.layer) {
						cache.clearLayer(ctx.cacheParams.layer.id)
					}
				}

				// merge the layer back into the cache
				if (ctx.cacheParams?.layer) {
					cache._internal_unstable.storage.resolveLayer(ctx.cacheParams.layer.id)
				}

				// keep going
				resolve(ctx)
			},
			catch(ctx, { error }) {
				// if there was an error, we need to clear the mutation
				if (ctx.cacheParams?.layer) {
					const { layer } = ctx.cacheParams

					// if the mutation failed, roll the layer back and delete it
					cache.clearLayer(layer.id)
					cache._internal_unstable.storage.resolveLayer(layer.id)
				}

				throw error
			},
		}
	})

export function injectOptimisticKeys(
	selection: SubscriptionSelection,
	obj: GraphQLObject,
	store: Set<string>
): any {
	// we need to walk the selection and inject the optimistic keys into the response
	// collect all of the fields that we need to write
	let targetSelection = getFieldsForType(
		selection,
		obj['__typename'] as string | undefined,
		false
	)

	// data is an object with fields that we need to write to the store
	for (const [field, { selection: fieldSelection, optimisticKey }] of Object.entries(
		targetSelection
	)) {
		// if this field is marked as an optimistic key, add it to the obj
		if (optimisticKey) {
			const key = new Date().getTime().toString()
			store.add(key)
			// @ts-ignore
			obj[field] = key
		}

		// if there is no sub-selection for this field, we're done
		if (!fieldSelection) {
			continue
		}

		// if there is no field underneath us but we have a selection, we're done
		if (!obj[field]) {
			continue
		}

		injectOptimisticKeys(fieldSelection, obj[field] as {}, store)
	}

	return obj
}
