import cache from '../../cache'
import { marshalSelection } from '../../lib/scalars'
import { ArtifactKind, SubscriptionSpec } from '../../lib/types'
import { documentPlugin } from '../utils'

export const mutationPlugin = documentPlugin(ArtifactKind.Mutation, () => {
	return {
		setup: {
			async enter(ctx, { next, marshalVariables }) {
				// treat a mutation like it has an optimistic layer regardless of
				// whether there actually _is_ one. This ensures that a query which fires
				// after this mutation has been sent will overwrite any return values from the mutation
				//
				// as far as I can tell, this is an arbitrary decision but it does give a
				// well-defined ordering to a subtle situation so that seems like a win
				const layer = cache._internal_unstable.storage.createLayer(true)

				// the optimistic response gets passed in the context's stuff bag
				// if there is an optimistic response then we need to write the value immediately
				const optimisticResponse = ctx.stuff.optimisticResponse

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
						layer: layer.id,
					})
				}

				// make sure we write to the correct layer in the cache
				next(ctx)
			},
			exit(ctx, { resolve, value }) {
				const hasErrors = value.errors && value.errors.length > 0
				// if there are errors, we need to clear the layer before resolving
				if (hasErrors) {
					// if the mutation failed, roll the layer back and delete it
					ctx.cacheParams?.layer?.clear()
				}

				// merge the layer back into the cache
				if (ctx.cacheParams?.layer) {
					cache._internal_unstable.storage.resolveLayer(ctx.cacheParams.layer.id)
				}

				// keep going
				resolve(ctx)
			},
		},
		network: {
			exit(ctx, { resolve }) {
				// before the cache sees the data, we need to clear the layer
				ctx.cacheParams?.layer?.clear()

				// we're done
				resolve(ctx)
			},
		},
		throw(ctx) {
			// if there was an error, we need to clear the mutation
			if (ctx.cacheParams?.layer) {
				const { layer } = ctx.cacheParams

				// if the mutation failed, roll the layer back and delete it
				layer.clear()
				cache._internal_unstable.storage.resolveLayer(layer.id)
			}
		},
	}
})
