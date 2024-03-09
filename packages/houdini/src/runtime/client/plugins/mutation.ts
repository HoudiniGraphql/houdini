import type { Cache } from '../../cache/cache'
import { marshalSelection } from '../../lib/scalars'
import type { SubscriptionSpec } from '../../lib/types'
import { ArtifactKind } from '../../lib/types'
import { documentPlugin } from '../utils'

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
