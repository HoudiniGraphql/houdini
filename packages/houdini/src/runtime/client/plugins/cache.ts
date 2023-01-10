import cache from '../../cache'
import { ArtifactKind, CachePolicy, DataSource } from '../../lib'
import { ClientPlugin } from '../documentObserver'
import { marshaledInputs } from './inputs'

export const cachePolicyPlugin =
	(setFetching: (val: boolean) => void): ClientPlugin =>
	() => {
		return {
			network: {
				enter(ctx, { next, resolve }) {
					const { policy, artifact } = ctx

					// enforce cache policies for queries
					if (policy) {
						// this function is called as the first step in requesting data. If the policy prefers
						// cached data, we need to load data from the cache (if its available). If the policy
						// prefers network data we need to send a request (the onLoad of the component will
						// resolve the next data)

						// if the cache policy allows for cached data, look at the caches value first
						if (policy !== CachePolicy.NetworkOnly) {
							// look up the current value in the cache
							const value = cache.read({
								selection: artifact.selection,
								variables: marshaledInputs(ctx),
							})

							// we can only use the result if its not a partial result
							const allowed =
								!value.partial ||
								// or the artifact allows for partial responses
								(artifact.kind === ArtifactKind.Query && artifact.partial)

							// if we have data, use that unless its partial data and we dont allow that
							if (value.data !== null && allowed) {
								return resolve(ctx, {
									result: {
										data: value.data,
										errors: [],
									},
									source: DataSource.Cache,
									partial: value.partial,
								})
							}

							// if the policy is cacheOnly and we got this far, we need to return null (no network request will be sent)
							else if (policy === CachePolicy.CacheOnly) {
								return resolve(ctx, {
									result: {
										data: null,
										errors: [],
									},
									source: DataSource.Cache,
									partial: false,
								})
							}
						}
					}

					// we're not using the cached data which means there will be a network request
					// tick the garbage collector asynchronously
					setTimeout(() => {
						cache._internal_unstable.collectGarbage()
					}, 0)

					// if we got this far, we shouldn't apply a cache policy so we are actually fetching something
					setFetching(true)

					// move on
					return next(ctx)
				},
				exit(ctx, { resolve, value }) {
					// if we have data coming in from the cache, we should write it and mvoe on
					if (value.result?.data) {
						// write the result of the mutation to the cache
						cache.write({
							...ctx.cacheParams,
							layer: ctx.cacheParams?.layer?.id,
							selection: ctx.artifact.selection,
							data: value.result.data,
							variables: marshaledInputs(ctx),
						})
					}

					// we're done. don't change the result value
					resolve(ctx)
				},
			},
		}
	}
