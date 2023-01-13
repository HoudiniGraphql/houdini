import { sleep } from '@kitql/helper'
import { test, expect, vi, beforeEach } from 'vitest'

import { HoudiniClient } from '.'
import { setMockConfig } from '../lib/config'
import { ArtifactKind, DataSource, GraphQLObject } from '../lib/types'
import { DocumentObserver, ClientPlugin } from './documentObserver'

function createStore(
	plugins: ClientPlugin[]
): DocumentObserver<GraphQLObject, Record<string, any>> {
	return new HoudiniClient({
		url: 'URL',
		pipeline() {
			return plugins
		},
	}).observe({
		artifact: {
			kind: ArtifactKind.Query,
			hash: '1234',
			raw: 'RAW_TEXT',
			name: 'TestArtifact',
			rootType: 'Query',
			selection: {},
			input: {
				types: {},
				fields: {
					date1: 'Date',
					date2: 'Date',
				},
			},
		},
		// turn off the cache since we aren't pushing actual graphql documents through by default
		cache: false,
	})
}

beforeEach(() => {
	setMockConfig({
		scalars: {
			Date: {
				type: 'Date',
				// turn the api's response into that type
				unmarshal(val: number) {
					return new Date(val)
				},
				// turn the value into something the API can use
				marshal(date: Date) {
					return date.getTime()
				},
			},
		},
	})
})

test('middleware pipeline happy path', async function () {
	const history: [number, string][] = []
	const tracker = (which: number, step: string) => {
		history.push([which, step])
	}

	const middleware1: ClientPlugin = () => ({
		setup: {
			enter(ctx, { next }) {
				tracker(1, 'one_enter')
				next(ctx)
			},
			exit(ctx, { resolve }) {
				tracker(1, 'one_exit')
				resolve(ctx)
			},
		},
		network: {
			enter(ctx, { next }) {
				tracker(1, 'two_enter')
				next(ctx)
			},
		},
	})
	const middleware2: ClientPlugin = () => {
		return {
			setup: {
				exit(ctx, { resolve }) {
					tracker(2, 'one_exit')
					resolve(ctx)
				},
			},
			network: {
				enter(ctx, { next }) {
					tracker(2, 'two_enter')
					next(ctx)
				},
				exit(ctx, { resolve }) {
					tracker(2, 'two_exit')
					resolve(ctx)
				},
			},
		}
	}

	const terminate: ClientPlugin = () => ({
		setup: {
			enter(ctx, { next }) {
				tracker(3, 'one_enter')
				next(ctx)
			},
			exit(ctx, { resolve }) {
				tracker(3, 'one_exit')
				resolve(ctx)
			},
		},
		network: {
			enter(ctx, { resolve }) {
				tracker(3, 'two_enter')
				resolve(ctx, {
					data: { hello: 'world' },
					errors: [],
					fetching: false,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
			},
			exit(ctx, { resolve }) {
				tracker(3, 'two_exit')
				resolve(ctx)
			},
		},
	})

	// create the client with the middlewares
	const store = createStore([middleware1, middleware2, terminate])

	// spy on the subscribe function
	const subscribeSpy = vi.fn()
	store.subscribe(subscribeSpy)

	// kick off the pipeline
	const value = await store.send()

	// make sure we called the hooks in the right order
	expect(history).toEqual([
		[1, 'one_enter'],
		[3, 'one_enter'],
		[1, 'two_enter'],
		[2, 'two_enter'],
		[3, 'two_enter'],
		[3, 'two_exit'],
		[2, 'two_exit'],
		[3, 'one_exit'],
		[2, 'one_exit'],
		[1, 'one_exit'],
	])

	// make sure we got the right value back
	expect(value).toEqual({
		fetching: false,
		variables: null,
		data: { hello: 'world' },
		errors: [],
		partial: false,
		source: DataSource.Cache,
	})
})

test('terminate short-circuits pipeline', async function () {
	const history: [number, string][] = []
	const tracker = (which: number, step: string) => {
		history.push([which, step])
	}

	const middleware1: ClientPlugin = () => ({
		setup: {
			enter(ctx, { next }) {
				tracker(1, 'one_enter')
				next(ctx)
			},
			exit(ctx, { resolve }) {
				tracker(1, 'one_exit')
				resolve(ctx)
			},
		},
		network: {
			enter(ctx, { next }) {
				tracker(1, 'two_enter')
				next(ctx)
			},
		},
	})
	const middleware2: ClientPlugin = () => {
		return {
			setup: {
				enter(ctx, { resolve }) {
					tracker(2, 'one_enter')
					resolve(ctx, {
						data: { hello: 'world' },
						errors: [],
						fetching: false,
						partial: false,
						source: DataSource.Cache,
						variables: null,
					})
				},
				exit(ctx, { resolve }) {
					tracker(2, 'one_exit')
					resolve(ctx, {
						data: { hello: 'world' },
						errors: [],
						fetching: false,
						partial: false,
						source: DataSource.Cache,
						variables: null,
					})
				},
			},
			network: {
				enter(ctx, { next }) {
					tracker(2, 'two_enter')
					next(ctx)
				},
				exit(ctx, { resolve }) {
					tracker(2, 'two_exit')
					resolve(ctx)
				},
			},
		}
	}

	// create the client with the middlewares
	const store = createStore([middleware1, middleware2])

	// kick off the pipeline
	await store.send()

	// make sure we called the hooks in the right order
	expect(history).toEqual([
		[1, 'one_enter'],
		[2, 'one_enter'],
		[2, 'one_exit'],
		[1, 'one_exit'],
	])
})

test('can call resolve multiple times to set multiple values', async function () {
	const middleware: ClientPlugin = () => ({
		network: {
			enter(ctx, { resolve }) {
				resolve(ctx, {
					data: { hello: 'world' },
					errors: [],
					fetching: false,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
				sleep(100).then(() =>
					resolve(ctx, {
						data: { hello: 'another-world' },
						errors: [],
						fetching: false,
						partial: false,
						source: DataSource.Cache,
						variables: null,
					})
				)
			},
		},
	})

	// create the client with the middlewares
	const store = createStore([middleware])
	const fn = vi.fn()
	store.subscribe(fn)

	// kick off the pipeline
	const result = await store.send()
	// wait enough time for the second  terminate to run
	await sleep(100)

	// make sure we get the first value  from the promise
	expect(result).toEqual({
		fetching: false,
		variables: null,
		data: { hello: 'world' },
		errors: [],
		partial: false,
		source: DataSource.Cache,
	})
	// that value will be the second value to the spy
	expect(fn).toHaveBeenNthCalledWith(2, {
		fetching: true,
		partial: false,
		source: null,

		data: null,
		errors: [],

		variables: null,
	})
	// and the third call will be the second call to terminate
	expect(fn).toHaveBeenNthCalledWith(3, {
		fetching: false,
		partial: false,

		data: { hello: 'world' },
		errors: [],
		source: DataSource.Cache,
		variables: null,
	})
	expect(fn).toHaveBeenNthCalledWith(4, {
		fetching: false,
		partial: false,

		data: { hello: 'another-world' },
		errors: [],
		source: DataSource.Cache,
		variables: null,
	})
})

test('error rejects the promise', async function () {
	const middleware: ClientPlugin = () => ({
		setup: {
			enter() {
				throw 'hello'
			},
		},
	})

	// create the client with the middlewares
	const store = createStore([middleware])

	// make sure that the promise rejected with the error value
	await expect(store.send()).rejects.toEqual('hello')
})

test('async error rejects the promise', async function () {
	const middleware: ClientPlugin = () => ({
		setup: {
			async enter() {
				throw 'hello'
			},
		},
	})

	// create the client with the middlewares
	const store = createStore([middleware])

	// make sure that the promise rejected with the error value
	await expect(store.send()).rejects.toEqual('hello')
})

test('cleanup phase', async function () {
	const spy = vi.fn()

	const middleware: ClientPlugin = () => ({
		cleanup() {
			spy()
		},
	})

	// create the client with the middlewares
	const store = createStore([middleware])
	const unsubscribe = store.subscribe(() => {})

	// call the unsubscribe function
	expect(spy).not.toHaveBeenCalled()
	unsubscribe()
	expect(spy).toHaveBeenCalled()
})

test('middlewares can set fetch params', async function () {
	const middleware1: ClientPlugin = () => ({
		setup: {
			enter(ctx, { next }) {
				ctx.fetchParams = {
					...ctx.fetchParams,
					headers: {
						hello: 'world',
					},
				}
				next(ctx)
			},
		},
	})

	const spy = vi.fn()
	const fetchMiddleware: ClientPlugin = () => ({
		setup: {
			enter(ctx, { resolve }) {
				spy(ctx.fetchParams)
				resolve(ctx, {
					data: { hello: 'world' },
					errors: [],
					fetching: false,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
			},
		},
	})

	// start the pipeline
	const store = createStore([middleware1, fetchMiddleware])
	await store.send()

	expect(spy).toBeCalledWith({
		headers: { hello: 'world' },
	})
})

test('tracks loading state', async function () {
	const middleware: ClientPlugin = () => ({
		network: {
			enter(ctx, { resolve }) {
				resolve(ctx, {
					data: { hello: 'world' },
					errors: [],
					fetching: false,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
			},
		},
	})

	// create a store we'll test with
	const store = createStore([middleware])
	// a spy to check the value
	const spy = vi.fn()
	store.subscribe(spy)

	// trigger the pipeline
	await store.send()

	// make sure we started off as loading
	expect(spy).toHaveBeenNthCalledWith(2, {
		fetching: true,
		partial: false,
		source: null,

		data: null,
		errors: [],
		variables: null,
	})
	// make sure we're not
	expect(spy).toHaveBeenNthCalledWith(3, {
		fetching: false,
		partial: false,
		source: DataSource.Cache,

		data: { hello: 'world' },
		errors: [],
		variables: null,
	})
})

test('exit can replay a pipeline', async function () {
	let count = 0

	const replayPlugin: ClientPlugin = () => ({
		setup: {
			exit(ctx, { value, next, resolve }) {
				if (value.data?.hello === 'world') {
					count++
					next(ctx)
				} else {
					resolve(ctx, {
						data: { hello: 'another-value' },
						errors: [],
						fetching: false,
						partial: false,
						source: DataSource.Cache,
						variables: null,
					})
				}
			},
		},
	})

	const source: ClientPlugin = () => ({
		setup: {
			enter(ctx, { resolve }) {
				// we have to get here twice to succeed
				if (count) {
					resolve(ctx, {
						data: { hello: 'another-value' },
						errors: [],
						fetching: false,
						partial: false,
						source: DataSource.Cache,
						variables: null,
					})
					return
				}

				resolve(ctx, {
					data: { hello: 'world' },
					errors: [],
					fetching: false,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
			},
		},
	})

	// create the client with the sources
	const store = createStore([replayPlugin, source])

	// make sure that the promise rejected with the error value
	await expect(store.send()).resolves.toEqual({
		fetching: false,
		variables: null,

		data: { hello: 'another-value' },
		partial: false,
		source: DataSource.Cache,
		errors: [],
	})
})

test('plugins can update variables', async function () {
	// a spy we'll pass the marshaled variables to
	const spy = vi.fn()

	// we're going to be passed in 2 dates
	const date1 = new Date()
	const date2 = new Date()
	date2.setHours(date1.getHours() + 10)

	const setVariables: ClientPlugin = () => {
		return {
			setup: {
				async enter(ctx, { next }) {
					// assign the new variables
					ctx.variables = {
						...ctx.variables,
						date1,
					}

					// move on
					next(ctx)
				},
			},
		}
	}

	const checkVariables: ClientPlugin = () => {
		return {
			network: {
				enter(ctx, { resolve, marshalVariables }) {
					spy(marshalVariables(ctx))
					resolve(ctx, {
						data: { hello: 'world' },
						errors: [],
						fetching: false,
						partial: false,
						source: DataSource.Cache,
						variables: null,
					})
				},
			},
		}
	}

	// create the client with the middlewares
	await createStore([setVariables, checkVariables]).send({
		variables: {
			date2,
		},
	})

	// make sure the spy was called with the correct values
	expect(spy).toHaveBeenCalledWith({
		date1: date1.getTime(),
		date2: date2.getTime(),
	})
})

test('can detect changed variables from inputs', async function () {
	// a spy to track changes
	const spy = vi.fn()

	// a plugin to detect changes
	const changePlugin: ClientPlugin = () => {
		return {
			setup: {
				enter(ctx, { next, variablesChanged }) {
					spy(variablesChanged(ctx))
					next(ctx)
				},
			},
			network: {
				enter(ctx, { resolve }) {
					resolve(ctx, {
						data: { hello: 'world' },
						errors: [],
						fetching: false,
						partial: false,
						source: DataSource.Cache,
						variables: null,
					})
				},
			},
		}
	}

	// instantiate a store we'll perform multiple queries with
	const store = createStore([changePlugin])

	// send one set of variables
	await store.send()
	expect(spy).toHaveBeenNthCalledWith(1, true)

	// send another empty set of variables
	await store.send()
	expect(spy).toHaveBeenNthCalledWith(2, false)

	// send with a known set
	await store.send({ variables: { hello: 'world' } })
	expect(spy).toHaveBeenNthCalledWith(3, true)

	// send with the same est
	await store.send({ variables: { hello: 'world' } })
	expect(spy).toHaveBeenNthCalledWith(4, false)
})

test('can update variables and then check if they were updated', async function () {
	// a spy to track changes
	const spy = vi.fn()

	// a plugin to detect changes
	const changePlugin: ClientPlugin = () => {
		return {
			setup: {
				enter(ctx, { next, variablesChanged }) {
					ctx.variables = {
						...ctx.variables,
						count: 0,
					}
					spy(variablesChanged(ctx))
					next(ctx)
				},
			},
			network: {
				enter(ctx, { resolve }) {
					resolve(ctx, {
						data: { hello: 'world' },
						errors: [],
						fetching: false,
						partial: false,
						source: DataSource.Cache,
						variables: null,
					})
				},
			},
		}
	}

	// instantiate a store we'll perform multiple queries with
	const store = createStore([changePlugin])

	// send one set of variables
	await store.send()
	expect(spy).toHaveBeenNthCalledWith(1, true)

	// send another empty set of variables
	await store.send()
	expect(spy).toHaveBeenNthCalledWith(2, false)

	// send with a known set
	await store.send({ variables: { hello: 'world' } })
	expect(spy).toHaveBeenNthCalledWith(3, true)
})

test('multiple new variables from inside plugin', async function () {
	// a spy to track changes
	const spy = vi.fn()

	let count = 0

	// a plugin to detect changes
	const changePlugin: ClientPlugin = () => {
		return {
			setup: {
				enter(ctx, { next, variablesChanged }) {
					let oldCount = count
					if (count === 0) {
						count++
					}
					ctx.variables = {
						...ctx.variables,
						count: oldCount,
					}
					spy(variablesChanged(ctx), oldCount)
					next(ctx)
				},
			},
			network: {
				enter(ctx, { resolve }) {
					resolve(ctx, {
						data: { hello: 'world' },
						errors: [],
						fetching: false,
						partial: false,
						source: DataSource.Cache,
						variables: null,
					})
				},
			},
		}
	}

	// instantiate a store we'll perform multiple queries with
	const store = createStore([changePlugin])

	// send one set of variables
	await store.send()
	expect(spy).toHaveBeenNthCalledWith(1, true, 0)

	// send another empty set of variables, count gets incremented
	await store.send()
	expect(spy).toHaveBeenNthCalledWith(2, true, 1)

	// send another empty set of variables, count won't get incremented
	await store.send()
	expect(spy).toHaveBeenNthCalledWith(3, false, 1)

	// send with a known set (count won't get incremented)
	await store.send()
	expect(spy).toHaveBeenNthCalledWith(4, false, 1)

	// if we do send with a payload, make sure we know its changed
	await store.send({ variables: { hello: 'world' } })
	expect(spy).toHaveBeenNthCalledWith(5, true, 1)

	// if we do send with a payload, send the same value for good measure
	await store.send({ variables: { hello: 'world' } })
	expect(spy).toHaveBeenNthCalledWith(6, false, 1)
})
