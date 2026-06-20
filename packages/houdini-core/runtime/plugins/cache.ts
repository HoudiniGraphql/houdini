import { Cache } from 'houdini/runtime/cache'
import type { ClientPlugin } from 'houdini/runtime/documentStore'
import { ArtifactKind, CachePolicy, DataSource, type GraphQLObject } from 'houdini/runtime/types'

import cache from '../cache.js'

const serverSide = typeof globalThis.window === 'undefined'

// walk the response data along a path collecting the record object(s) at the end.
// a path segment can resolve to a list (eg a @refetch field nested under a list)
// so each step may fan out to multiple records.
export function recordsAtPath(
	data: GraphQLObject | null,
	path: readonly string[]
): GraphQLObject[] {
	let current: any[] = data ? [data] : []
	for (const key of path) {
		const next: any[] = []
		for (const entry of current) {
			if (entry == null) {
				continue
			}
			const value = entry[key]
			if (Array.isArray(value)) {
				next.push(...value.flat(Infinity))
			} else if (value != null) {
				next.push(value)
			}
		}
		current = next
	}
	return current.filter((entry) => entry && typeof entry === 'object')
}

export const cachePolicy =
	({
		enabled,
		setFetching,
		cache: localCache = cache,
		serverSideFallback = true,
	}: {
		enabled: boolean
		setFetching: (val: boolean, data?: any) => void
		cache?: Cache
		serverSideFallback?: boolean
	}): ClientPlugin =>
	() => {
		return {
			beforeNetwork(ctx, { initialValue, next, resolve, marshalVariables }) {
				const { policy, artifact } = ctx
				let useCache = false
				// enforce cache policies for queries
				if (
					enabled &&
					(artifact.kind === ArtifactKind.Query ||
						artifact.kind === ArtifactKind.Fragment) &&
					!ctx.cacheParams?.disableRead
				) {
					// this function is called as the first step in requesting data. If the policy prefers
					// cached data, we need to load data from the cache (if its available). If the policy
					// prefers network data we need to send a request (the onLoad of the component will
					// resolve the next data)

					// if the cache policy allows for cached data, look at the cache's value first
					const policyAllowsCache =
						policy !== CachePolicy.NetworkOnly && policy !== CachePolicy.NoCache
					if (policyAllowsCache) {
						// look up the current value in the cache
						const value = localCache.read({
							selection: artifact.selection,
							variables: marshalVariables(ctx),
							fullCheck: true,
						})

						// we can only use the result if its not a partial result
						const allowed =
							!value.partial ||
							// or the artifact allows for partial responses, and the caller
							// hasn't opted out (e.g. SinglePage pagination suppresses partial
							// cache hits to avoid flashing intermediate states)
							(artifact.kind === ArtifactKind.Query &&
								artifact.partial &&
								!ctx.cacheParams?.disablePartial)

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

						// if we have data, use that unless it's partial data and we don't allow that
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
						if (
							useCache &&
							!value.partial &&
							!value.stale &&
							// if the policy is CacheAndNetwork then we don't want to stop here regardless
							ctx.policy !== 'CacheAndNetwork'
						) {
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
				// don't set the fetching state to true if we accepted a cache value
				if (!ctx.stuff?.silenceLoading) {
					// don't set the fetching state to true if we accepted a cache value
					let fetchingState: GraphQLObject | null = null
					if (
						!useCache &&
						'enableLoadingState' in artifact &&
						artifact.enableLoadingState
					) {
						fetchingState = localCache.read({
							selection: artifact.selection,
							variables: marshalVariables(ctx),
							loading: true,
						}).data
					}
					setFetching(!useCache, fetchingState)
				}
				// move on
				return next(ctx)
			},
			afterNetwork(ctx, { resolve, value, marshalVariables }) {
				// if we have data coming in from the cache, we should write it and move on
				if (
					ctx.policy !== CachePolicy.NoCache &&
					value.source !== DataSource.Cache &&
					enabled &&
					value.data &&
					!ctx.cacheParams?.disableWrite
				) {
					// if the cache params specify a fallback behavior, use that
					if (ctx.cacheParams && 'serverSideFallback' in ctx.cacheParams) {
						serverSideFallback =
							ctx.cacheParams?.serverSideFallback ?? serverSideFallback
					}

					const targetCache =
						serverSide && serverSideFallback
							? new Cache({ disabled: false, ...ctx.config })
							: localCache

					let layer: number | undefined
					if (!serverSide && ctx.cacheParams?.layer) {
						layer = ctx.cacheParams.layer.id
					}

					// write the result of the mutation to the cache
					targetCache.write({
						...ctx.cacheParams,
						layer,
						selection: ctx.artifact.selection,
						data: value.data,
						variables: marshalVariables(ctx),
					})

					// document-level operations run once the response has been written.
					// @refetch asks every document that depends on a record to reload
					// itself. only mutations and subscriptions trigger this so a query
					// can't refetch itself.
					if (
						(ctx.artifact.kind === ArtifactKind.Mutation ||
							ctx.artifact.kind === ArtifactKind.Subscription) &&
						ctx.artifact.operations?.length &&
						!ctx.cacheParams?.disableWrite
					) {
						// gather every record id tagged with @refetch, deduped, so a
						// document that depends on several of them only refetches once
						const refreshIDs = new Set<string>()
						for (const operation of ctx.artifact.operations) {
							if (operation.action !== 'refetch') {
								continue
							}

							for (const record of recordsAtPath(value.data, operation.path)) {
								const id = targetCache._internal_unstable.id(
									(record.__typename as string) ?? operation.type,
									record
								)
								if (id) {
									refreshIDs.add(id)
								}
							}
						}

						if (refreshIDs.size > 0) {
							targetCache.refresh([...refreshIDs])
						}
					}

					// we need to embed the fragment context values in our response
					// and apply masking other value transforms. In order to do that,
					// we're going to read back what we just wrote. This only incurs
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
