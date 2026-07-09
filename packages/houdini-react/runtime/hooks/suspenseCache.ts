import { createLRUCache } from 'houdini/runtime'
import type { GraphQLObject, GraphQLVariables, QueryArtifact, LRUCache } from 'houdini/runtime'
import type { Cache } from 'houdini/runtime/cache'
import type { DocumentStore } from 'houdini/runtime/client'

import { isObserverRetained } from './observerRefs.js'
import type { DocumentHandle } from './useDocumentHandle.js'

export type QuerySuspenseUnit<
	_Data extends GraphQLObject = GraphQLObject,
	_Input extends GraphQLVariables = GraphQLVariables,
> = {
	resolve: () => void
	resolved?: DocumentHandle<QueryArtifact, _Data, _Input>
	// a failed fetch parks its error here (and resolves the thenable): the suspense
	// protocol retries the render on resolution, and the retry throws this to the
	// nearest error boundary. rejecting the thenable instead would make react retry a
	// render that starts a brand new fetch — an error loop.
	rejected?: unknown
	then: (val: any) => any
	// the store that started the fetch. suspending discards the component instance that
	// created it, so the retry render has to pick this store back up — the cache
	// subscription created by the fetch belongs to it, and a fresh store would never
	// hear about later cache updates (a mutation write, a list operation)
	observer: DocumentStore<GraphQLObject, GraphQLVariables>
}

// suspense state is scoped to the Cache instance: the browser has exactly one so the
// scoping is invisible there, but on the server the cache is created per request — and
// suspense units carry resolved query data, which can be session-dependent. a module-wide
// cache would let one request's render serve another user's data.
const promiseCaches = new WeakMap<Cache, LRUCache<QuerySuspenseUnit>>()

export function promiseCacheFor(cache: Cache): LRUCache<QuerySuspenseUnit> {
	let result = promiseCaches.get(cache)
	if (!result) {
		result = createLRUCache<QuerySuspenseUnit>(1000, (unit) => {
			// a unit leaving the cache whose store no committed component ever picked up is
			// an abandoned suspense (suspended, then unmounted before commit) or an errored
			// fetch — dispose the store so its cache subscription doesn't outlive it.
			// retained stores are governed by their holders instead.
			if (!isObserverRetained(unit.observer)) {
				unit.observer.cleanup()
			}
		})
		promiseCaches.set(cache, result)
	}
	return result
}

// a session change invalidates every cached query result. the router clears its own
// caches (data_cache et al); this is the same sweep for useQuery's suspense state, so a
// session-dependent useQuery refetches instead of serving data fetched under the old
// session. clearing evicts every unit (disposing unretained stores); mounted components
// re-render off the session context, miss the cache, and re-suspend into a fresh fetch.
export function invalidateSuspenseCache(cache: Cache) {
	promiseCaches.get(cache)?.clear()
}
