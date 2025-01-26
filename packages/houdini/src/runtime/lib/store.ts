// The code in this file is a modified version of logic from the Svelte codebase subject to the MIT license contained at the
// bottom of this file

const subscriber_queue: any[] = []
const noop = () => {}

export class Writable<T> {
	state: T
	#subscribers: Set<SubscribeInvalidateTuple<T>>
	#stop: Unsubscriber | null
	#start: StartStopNotifier<T>

	constructor(value: T, start: StartStopNotifier<T> = noop) {
		this.state = value
		this.#subscribers = new Set()
		this.#stop = null
		this.#start = start
	}

	set(new_value: T): void {
		if (safe_not_equal(this.state, new_value)) {
			this.state = new_value
			if (this.#stop) {
				// store is ready
				const run_queue = !subscriber_queue.length
				for (const subscriber of this.#subscribers) {
					subscriber[1]()
					subscriber_queue.push(subscriber, this.state)
				}
				if (run_queue) {
					for (let i = 0; i < subscriber_queue.length; i += 2) {
						subscriber_queue[i][0](subscriber_queue[i + 1])
					}
					subscriber_queue.length = 0
				}
			}
		}
	}

	update(fn: Updater<T>): void {
		this.set(fn(this.state))
	}

	subscribe(run: Subscriber<T>, invalidate: Invalidator<T> = noop): Unsubscriber {
		const subscriber: SubscribeInvalidateTuple<T> = [run, invalidate]
		this.#subscribers.add(subscriber)
		if (this.#subscribers.size === 1) {
			this.#stop = this.#start(this.set) || noop
		}
		run(this.state)

		return () => {
			this.#subscribers.delete(subscriber)
			if (this.#subscribers.size === 0) {
				this.#stop?.()
				this.#stop = null
			}
		}
	}
}

function safe_not_equal(a: any, b: any) {
	return a != a ? b == b : a !== b || (a && typeof a === 'object') || typeof a === 'function'
}

/** Start and stop notification callbacks. */
type StartStopNotifier<T> = (set: Subscriber<T>) => Unsubscriber | void

/** Pair of subscriber and invalidator. */
type SubscribeInvalidateTuple<T> = [Subscriber<T>, Invalidator<T>]

/** Callback to inform of a value updates. */
export type Subscriber<T> = (value: T) => void

/** Unsubscribes from value updates. */
export type Unsubscriber = () => void

/** Callback to update a value. */
type Updater<T> = (value: T) => T

/** Cleanup logic callback. */
type Invalidator<T> = (value?: T) => void

/*
Copyright (c) 2016-22 [these people](https://github.com/sveltejs/svelte/graphs/contributors)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
