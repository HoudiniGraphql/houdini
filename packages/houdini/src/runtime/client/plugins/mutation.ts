import cache from '../../cache'
import { ClientPlugin } from '../documentObserver'

export const mutationPlugin: ClientPlugin = function () {
	return {
		setup: {
			enter(ctx, { next }) {
				// treat a mutation like it has an optimistic layer regardless of
				// whether there actually _is_ one. This ensures that a query which fires
				// after this mutation has been sent will overwrite any return values from the mutation
				//
				// as far as I can tell, this is an arbitrary decision but it does give a
				// well-defined ordering to a subtle situation so that seems like a win
				const layer = cache._internal_unstable.storage.createLayer(true)

				// make sure we write to the correct layer in the cache
				next({
					...ctx,
					cacheParams: {
						...ctx.cacheParams,
						// write to the mutation's layer
						layer,
						// notify any subscribers that we updated with the optimistic response
						// in order to address situations where the optimistic update was wrong
						notifySubscribers: [],
						// make sure that we notify subscribers for any values that we overwrite
						// in order to address any race conditions when comparing the previous value
						forceNotify: true,
					},
				})
			},
			exit(ctx, { resolve }) {
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
		error(ctx, { next }) {
			// if there was an error, we need to clear the mutation
			if (ctx.cacheParams?.layer) {
				const { layer } = ctx.cacheParams

				// if the mutation failed, roll the layer back and delete it
				layer.clear()
				cache._internal_unstable.storage.resolveLayer(layer.id)
			}

			// we're done
			next(ctx)
		},
	}
}
