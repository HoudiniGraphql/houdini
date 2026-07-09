import type { GraphQLObject, CachePolicies, QueryArtifact, GraphQLVariables } from 'houdini/runtime'
import type { DocumentStore } from 'houdini/runtime/client'
import React from 'react'

import { GraphQLErrors, useRouterContext } from '../routing/index.js'
import { releaseObserver, retainObserver } from './observerRefs.js'
import { promiseCacheFor, type QuerySuspenseUnit } from './suspenseCache.js'
import type { DocumentHandle } from './useDocumentHandle.js'
import { useDocumentHandle } from './useDocumentHandle.js'
import { useIsMountedRef } from './useIsMounted.js'

// Suspense requires a way to throw a promise that resolves to a place
// we can put when we go back on a susequent render. This means that we have to have
// a stable way to identify _this_ useQueryHandle called.
// For now, we're going to compute an identifier based on the name of the artifact
// and the variables that we were given.
//
// - If we have a cached promise that's pending, we should just throw that promise
// - If we have a cached promise that's been resolved, we should return that value
//
// When the Component unmounts, we need to remove the entry from the cache (so we can load again)
//
// The suspense state itself lives in suspenseCache.ts, scoped per Cache instance (i.e.
// per request on the server) and invalidated on session changes.

export function useQueryHandle<
	_Artifact extends QueryArtifact,
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends GraphQLVariables = GraphQLVariables,
>(
	{ artifact }: { artifact: QueryArtifact },
	variables: any = null,
	config: UseQueryConfig = {}
): any {
	// the client, the per-request cache (a singleton in the browser), and — during a
	// server render — the stream injector all come from the router context
	const { client, cache, injectToStream } = useRouterContext()

	// suspense state lives on the per-request cache so SSR requests can't see each other's
	const promiseCache = promiseCacheFor(cache)

	// figure out the identifier so we know what to look for
	const identifier = queryIdentifier({ artifact, variables, config })

	// see if we have an entry in the cache for the identifier
	const suspenseValue = promiseCache.get(identifier)

	// a failed fetch: surface the error to the nearest boundary, and drop the unit so a
	// later mount (e.g. navigating back after the error boundary took over) retries
	// instead of re-throwing the stale error forever
	if (suspenseValue?.rejected) {
		promiseCache.delete(identifier)
		throw suspenseValue.rejected
	}

	const isMountedRef = useIsMountedRef()

	// hold onto an observer we'll use. if a fetch for this identifier already started, we
	// have to reuse the store that started it: suspending threw away the component
	// instance that created it, and the cache subscription set up by that fetch belongs
	// to that store — a fresh one would render fine but never hear about later cache
	// updates. the initial value has to stay null (not an empty object) until the
	// suspense promise resolves: every "do we have data yet" check below is a truthiness
	// check, and a truthy empty object makes a re-render that happens mid-flight (eg a
	// parent state update) commit the component with empty data instead of re-throwing
	// the pending promise.
	const [observer] = React.useState(
		() =>
			(suspenseValue?.observer as DocumentStore<_Data, _Input> | undefined) ??
			client.observe<_Data, _Input>({
				artifact,
				initialValue: (suspenseValue?.resolved?.data ?? null) as _Data,
			})
	)

	// a ref flag we'll enable before throwing so that we don't update while suspend
	const suspenseTracker = React.useRef(false)

	// a stable box to put the store's value
	const box = React.useRef(observer.state)

	// a stable subscribe function for the document store
	const subscribe: any = React.useCallback(
		(fn: () => void) => {
			return observer.subscribe((val) => {
				box.current = val
				if (isMountedRef.current && !suspenseTracker.current) {
					fn()
				}
			})
		},
		[observer, isMountedRef.current]
	)

	// get a safe reference to the cache. the server snapshot is what lets this hook render
	// during SSR at all: without it react throws before the fetch ever starts and the whole
	// subtree falls back to client rendering.
	const storeValue = React.useSyncExternalStore(
		subscribe,
		() => box.current,
		() => box.current
	)

	// compute the imperative handle for this artifact
	const handle = useDocumentHandle<_Artifact, _Data, _Input>({
		artifact,
		observer,
		storeValue,
	})

	// if the identifier changes, we need to remove the old identifier from the
	// suspense cache
	React.useEffect(() => {
		return () => {
			promiseCache.delete(identifier)
		}
	}, [identifier])

	// a committed component holds a reference on its store; the store tears down when
	// the last holder unmounts (see observerRefs.ts)
	React.useEffect(() => {
		retainObserver(observer)
		return () => {
			releaseObserver(observer)
		}
	}, [observer])

	// suspenseTracker mutes store notifications while we're suspended. on the initial
	// mount the flag dies with the discarded pre-commit instance, but when a committed
	// instance re-suspends (its variables changed) the flag flips on its own ref and
	// nothing else clears it — the subscription would stay muted forever. effects only
	// run for committed (non-throwing) renders, so this is the spot to unmute.
	React.useEffect(() => {
		suspenseTracker.current = false
	})

	// if the promise has resolved, let's use that for our first render
	const result = storeValue.data

	if (!suspenseValue) {
		// we are going to cache the promise and then throw it
		// when it resolves the cached value will be updated
		// and it will be picked up in the next render
		// note: the thenable only ever resolves — failures park on suspenseUnit.rejected
		// and resolve, so the retry render throws them (see the rejected check above)
		let resolve: () => void = () => {}
		const loadPromise = new Promise<void>((res) => {
			resolve = res
		})

		const suspenseUnit: QuerySuspenseUnit<_Data, _Input> = {
			// biome-ignore lint/suspicious/noThenProperty: suspense protocol requires a thenable
			then: loadPromise.then.bind(loadPromise),
			resolve,
			observer: observer as unknown as DocumentStore<GraphQLObject, GraphQLVariables>,
			// @ts-expect-error
			variables,
		}

		promiseCache.set(identifier, suspenseUnit as QuerySuspenseUnit)

		// the suspense unit gives react something to hold onto
		// and it acts as a place for us to register a callback on
		// send to update the cache before resolving the suspense
		handle
			.fetch({
				variables,
				// @ts-expect-error: this is actually allowed... 🤫
				stuff: {
					silenceLoading: true,
				},
			})
			.then((value) => {
				// a graphql error must reach the error boundary, not resolve the suspense
				// with null data (the component would crash reading its fields). same error
				// shape route queries throw, so +error boundaries see the graphql errors.
				// park it on the unit and resolve — the retry render throws it (see the
				// rejected check above; rejecting the thenable would make react retry into
				// a brand new fetch, an error loop)
				if (value.errors && value.errors.length > 0) {
					suspenseUnit.rejected = new GraphQLErrors(value.errors)
					suspenseUnit.resolve()
					return
				}

				// the final value
				suspenseUnit.resolved = {
					...handle,
					data: value.data,
					partial: value.partial,
					artifact,
				} as unknown as DocumentHandle<QueryArtifact, _Data, _Input>

				// on the server, ship the resolved cache snapshot to the browser the same way
				// route queries stream theirs: hydration then serves this query straight from
				// the cache instead of refetching over the network. (a query that resolves
				// before the shell flushes doesn't need this — its data rides the initial
				// cache snapshot the server embeds in the document — and the injector wrapper
				// no-ops in that window.)
				if (!globalThis.window) {
					injectToStream?.(`
						<script>
						{
							const __houdini__snapshot__ = ${cache.serialize()}
							if (window.__houdini__cache__) {
								// hydrate into a fresh layer and merge it down, rather than clobbering the
								// shared hydration layer (which would drop everything hydrated before it)
								const __houdini__layer__ = window.__houdini__cache__.hydrate(__houdini__snapshot__)
								if (__houdini__layer__) {
									window.__houdini__cache__._internal_unstable.storage.resolveLayer(__houdini__layer__.id)
								}
							} else {
								(window.__houdini__pending_cache__ = window.__houdini__pending_cache__ || []).push(__houdini__snapshot__)
							}
						}
						</script>
					`)
				}

				suspenseUnit.resolve()
			})
			.catch((err) => {
				// same protocol as graphql errors: park and resolve so the retry render
				// throws to the boundary instead of starting a fresh fetch
				suspenseUnit.rejected = err
				suspenseUnit.resolve()
			})
		suspenseTracker.current = true
		throw suspenseUnit
	}

	// if the promise is still pending, we're still waiting
	if (!result && suspenseValue && !suspenseValue.resolved) {
		suspenseTracker.current = true
		throw suspenseValue
	}

	// make sure we prefer the latest store value instead of the initial version we loaded on mount
	if (!result && suspenseValue?.resolved) {
		return suspenseValue.resolved as unknown as DocumentHandle<_Artifact, _Data, _Input>
	}

	return {
		...handle,
		variables: storeValue.variables,
		data: result,
	}
}

export type UseQueryConfig = {
	policy?: CachePolicies
	metadata?: App.Metadata
	fetchKey?: any
}

function queryIdentifier(args: {
	artifact: QueryArtifact
	fetchKey?: number
	variables: {}
	config: UseQueryConfig
}): string {
	// make sure there is always a fetchKey
	args.fetchKey ??= 0

	// pull the common stuff out
	const { artifact, variables, fetchKey } = args

	// a query identifier is a mix of its name, arguments, and the fetch key
	return [artifact.name, JSON.stringify(variables), fetchKey].join('@@')
}
