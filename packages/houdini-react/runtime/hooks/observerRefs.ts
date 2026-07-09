// Committed components hold a reference on their document store: two components
// rendering the same query+variables share one store through the suspense cache, so the
// store can only tear down when the LAST holder unmounts. The count is backed by a real
// (no-op) subscription because the underlying store runs its plugin cleanups (dropping
// the cache subscription) whenever its subscriber count touches zero — which react's
// strict-mode effect replay does to the component's own subscription.

// the only thing retain/release need from a store is subscribe
type Holdable = {
	subscribe: (fn: (value: any) => void) => () => void
}

const observerRefs = new WeakMap<Holdable, { count: number; hold: () => void }>()

export function retainObserver(observer: Holdable) {
	const entry = observerRefs.get(observer)
	if (entry) {
		entry.count++
		return
	}
	observerRefs.set(observer, { count: 1, hold: observer.subscribe(() => {}) })
}

export function releaseObserver(observer: Holdable) {
	const entry = observerRefs.get(observer)
	if (!entry) {
		return
	}
	entry.count--
	if (entry.count > 0) {
		return
	}
	// defer the disposal a tick: strict mode releases and synchronously re-retains, and
	// dropping the hold at zero immediately would tear the store down mid-replay
	setTimeout(() => {
		const current = observerRefs.get(observer)
		if (!current || current.count > 0) {
			return
		}
		observerRefs.delete(observer)
		// dropping the hold makes the store's own last-unsubscriber teardown run the
		// plugin cleanups (including the cache unsubscribe)
		current.hold()
	}, 0)
}

// whether any committed component currently holds the store (used to decide if an
// evicted suspense unit's store was abandoned and needs explicit disposal)
export function isObserverRetained(observer: Holdable): boolean {
	return observerRefs.has(observer)
}
