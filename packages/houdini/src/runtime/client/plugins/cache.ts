import cache from '../../cache'
import { Cache } from '../../cache/cache'
import { ArtifactKind, CachePolicy, DataSource } from '../../lib/types'
import type { ClientPlugin } from '../documentStore'

const serverSide = typeof globalThis.window === 'undefined'

export const cachePolicy =
	({
		enabled,
		setFetching,
		cache: localCache = cache,
		serverSideFallback = true,
	}: {
		enabled: boolean
		setFetching: (val: boolean) => void
		cache?: Cache
		serverSideFallback?: boolean
	}): ClientPlugin =>
	() => {
		return {
			network(ctx, { initialValue, next, resolve, marshalVariables }) {
				const { policy, artifact } = ctx
				let useCache = false
				// enforce cache policies for queries
				if (
					enabled &&
					artifact.kind === ArtifactKind.Query &&
					!ctx.cacheParams?.disableRead
				) {
					// this function is called as the first step in requesting data. If the policy prefers
					// cached data, we need to load data from the cache (if its available). If the policy
					// prefers network data we need to send a request (the onLoad of the component will
					// resolve the next data)

					// if the cache policy allows for cached data, look at the caches value first
					if (policy !== CachePolicy.NetworkOnly) {
						// look up the current value in the cache
						const value = localCache.read({
							selection: artifact.selection,
							variables: marshalVariables(ctx),
						})

						// we can only use the result if its not a partial result
						const allowed =
							!value.partial ||
							// or the artifact allows for partial responses
							(artifact.kind === ArtifactKind.Query && artifact.partial)

						// if the policy is cacheOnly and we got this far, we need to return null (no network request will be sent)
						if (policy === CachePolicy.CacheOnly) {
							return resolve(ctx, {
								fetching: false,
								variables: ctx.variables ?? null,
								data: allowed ? value.data : initialValue.data,
								errors: null,
								source: DataSource.Cache,
								partial: allowed ? value.partial : false,
								stale: value.stale,
							})
						}

						// if we have data, use that unless its partial data and we dont allow that
						useCache = !!(value.data !== null && allowed)
						if (useCache) {
							resolve(ctx, {
								fetching: false,
								variables: ctx.variables ?? null,
								data: value.data,
								errors: null,
								source: DataSource.Cache,
								partial: value.partial,
								stale: value.stale,
							})
						}

						// if we used the cache data and there's no followup necessary, we're done
						if (useCache && !value.partial && !value.stale) {
							return
						}
					}
				}

				// we're not using the cached data which means there will be a network request
				// tick the garbage collector asynchronously
				if (enabled) {
					setTimeout(() => {
						localCache._internal_unstable.collectGarbage()
					}, 0)
				}

				// if we got this far, we are resolving something against the network
				// dont set the fetching state to true if we accepted a cache value
				setFetching(!useCache)

				// move on
				return next(ctx)
			},
			afterNetwork(ctx, { resolve, value, marshalVariables }) {
				// if we have data coming in from the cache, we should write it and move on
				if (
					value.source !== DataSource.Cache &&
					enabled &&
					value.data &&
					!ctx.cacheParams?.disableWrite
				) {
					const targetCache =
						serverSide && serverSideFallback
							? new Cache({ disabled: false })
							: localCache

					// write the result of the mutation to the cache
					targetCache.write({
						...ctx.cacheParams,
						layer: ctx.cacheParams?.layer?.id,
						selection: ctx.artifact.selection,
						data: value.data,
						variables: marshalVariables(ctx),
					})

					// we need to embed the fragment context values in our response
					// and apply masking other value transforms. In order to do that,
					// we're goin to read back what we just wrote. This only incurs
					// extra computation on the server-side since we have to write the values
					// before we can read them (instead of just transforming the value directly)
					value = {
						...value,
						data: targetCache.read({
							selection: ctx.artifact.selection,
							variables: marshalVariables(ctx),
							ignoreMasking: serverSide,
						}).data,
					}
				}

				// we're done. don't change the result value
				resolve(ctx, value)
			},
		}
	}
