import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { isObserverRetained, releaseObserver, retainObserver } from './observerRefs'

beforeEach(() => {
	vi.useFakeTimers()
})
afterEach(() => {
	vi.useRealTimers()
})

// a minimal store: retain/release only need subscribe, and the tests only need to know
// whether the hold subscription is still open
function fakeObserver() {
	let subscribers = 0
	return {
		subscribe: (_fn: (value: any) => void) => {
			subscribers++
			return () => {
				subscribers--
			}
		},
		get held() {
			return subscribers > 0
		},
	}
}

test('retaining opens a hold subscription; the last release drops it after a tick', () => {
	const observer = fakeObserver()

	retainObserver(observer)
	expect(observer.held).toBe(true)
	expect(isObserverRetained(observer)).toBe(true)

	releaseObserver(observer)
	// disposal is deferred a tick so strict mode's synchronous re-retain can cancel it
	expect(observer.held).toBe(true)
	vi.runAllTimers()
	expect(observer.held).toBe(false)
	expect(isObserverRetained(observer)).toBe(false)
})

test('the hold survives while any holder remains', () => {
	const observer = fakeObserver()

	retainObserver(observer)
	retainObserver(observer)
	releaseObserver(observer)
	vi.runAllTimers()

	// one holder left: still held
	expect(observer.held).toBe(true)
	expect(isObserverRetained(observer)).toBe(true)

	releaseObserver(observer)
	vi.runAllTimers()
	expect(observer.held).toBe(false)
})

test('a synchronous re-retain cancels the pending disposal (strict mode replay)', () => {
	const observer = fakeObserver()

	// mount → simulated unmount → mount again, all before the timer fires
	retainObserver(observer)
	releaseObserver(observer)
	retainObserver(observer)
	vi.runAllTimers()

	expect(observer.held).toBe(true)
	expect(isObserverRetained(observer)).toBe(true)

	// and the store still tears down once the real unmount happens
	releaseObserver(observer)
	vi.runAllTimers()
	expect(observer.held).toBe(false)
})

test('releasing an unretained observer is a no-op', () => {
	const observer = fakeObserver()

	releaseObserver(observer)
	vi.runAllTimers()

	expect(observer.held).toBe(false)
	expect(isObserverRetained(observer)).toBe(false)

	// and it can still be retained normally afterwards
	retainObserver(observer)
	expect(observer.held).toBe(true)
})
