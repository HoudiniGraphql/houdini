import { sleep } from '@kitql/helper'
import { setMockConfig } from 'houdini'
import { test, expect, vi, beforeEach } from 'vitest'

import { HoudiniClient } from '.'
import { ArtifactKind } from '../lib/types'
import { DocumentObserver, ClientPlugin } from './documentObserver'
import { marshaledVariables } from './plugins'

function createStore(plugins: ClientPlugin[]): DocumentObserver<any, any> {
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
				unmarshal(val) {
					return new Date(val)
				},
				// turn the value into something the API can use
				marshal(date) {
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
				resolve(ctx, { result: { data: 'value', errors: [] } })
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
	expect(value).toEqual({ result: { data: 'value', errors: [] } })
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
					resolve(ctx, { result: { data: 'value', errors: [] } })
				},
				exit(ctx, { resolve }) {
					tracker(2, 'one_exit')
					resolve(ctx, { result: { data: 'value', errors: [] } })
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
				resolve(ctx, { result: { data: 'value', errors: [] } })
				sleep(100).then(() =>
					resolve(ctx, { result: { data: 'another-value', errors: [] } })
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
	expect(result).toEqual({ result: { data: 'value', errors: [] } })
	// that value will be the second value to the spy
	expect(fn).toHaveBeenNthCalledWith(2, {
		fetching: true,
		partial: false,
		source: null,
		result: {
			data: null,
			errors: [],
		},
		variables: {},
	})
	// and the third call will be the second call to terminate
	expect(fn).toHaveBeenNthCalledWith(3, {
		fetching: false,
		partial: false,
		result: {
			data: 'value',
			errors: [],
		},
		source: null,
		variables: {},
	})
	expect(fn).toHaveBeenNthCalledWith(4, {
		fetching: false,
		partial: false,
		result: {
			data: 'another-value',
			errors: [],
		},
		source: null,
		variables: {},
	})
})

test('error can replay chain', async function () {
	let count = 0

	// we want to make sure that the errors dont bubble up beyond the middleware that
	// traps it
	const outerSpy = vi.fn()
	const spy = vi.fn()

	const firstErrorHandler: ClientPlugin = () => ({
		error(ctx) {
			outerSpy()
		},
	})

	const errorTrapper: ClientPlugin = () => ({
		error(ctx, { next, error }) {
			// invoke the spy (we got here once)
			spy(error)

			// try again but this time, succeed
			count++
			next(ctx)
		},
	})

	const middleware: ClientPlugin = () => ({
		setup: {
			enter(ctx, { resolve }) {
				// we have to get here twice to succeed
				if (count) {
					resolve(ctx, { result: { data: 'value', errors: [] } })
					return
				}

				throw 'hello'
			},
		},
	})

	// create the client with the middlewares
	const store = createStore([firstErrorHandler, errorTrapper, middleware])

	// make sure that the promise rejected with the error value
	await expect(store.send()).resolves.toEqual({
		result: {
			data: 'value',
			errors: [],
		},
	})
	expect(spy).toHaveBeenCalled()
	expect(outerSpy).not.toHaveBeenCalled()
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

test('middlewares can set twoParams', async function () {
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
				resolve(ctx, { result: { data: 'value', errors: [] } })
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
				resolve(ctx, { result: { data: 'value', errors: [] } })
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
		result: {
			data: null,
			errors: [],
		},
		variables: {},
	})
	// make sure we're not
	expect(spy).toHaveBeenNthCalledWith(3, {
		fetching: false,
		partial: false,
		source: null,
		result: {
			data: 'value',
			errors: [],
		},
		variables: {},
	})
})

test('test can replay a pipeline', async function () {
	let count = 0

	const firstErrorHandler: ClientPlugin = () => ({
		setup: {
			exit(ctx, { value, next, resolve }) {
				if (value.result?.data === 'value') {
					count++
					next(ctx)
				} else {
					resolve(ctx, {
						result: {
							data: 'another-value',
							errors: [],
						},
					})
				}
			},
		},
	})

	const middleware: ClientPlugin = () => ({
		setup: {
			enter(ctx, { resolve }) {
				// we have to get here twice to succeed
				if (count) {
					resolve(ctx, { result: { data: 'another-value', errors: [] } })
					return
				}

				resolve(ctx, { result: { data: 'value', errors: [] } })
			},
		},
	})

	// create the client with the middlewares
	const store = createStore([firstErrorHandler, middleware])

	// make sure that the promise rejected with the error value
	await expect(store.send()).resolves.toEqual({
		result: {
			data: 'another-value',
			errors: [],
		},
	})
})

test('plugins can update variables', async function () {
	// a spy we'll pass the marshaled variables to
	const spy = vi.fn()

	// we're going to be passed in 2 dates
	const date1 = new Date()
	const date2 = new Date().setHours(date1.getHours() + 10)

	const setVariables: ClientPlugin = () => {
		return {
			setup: {
				enter(ctx, { next }) {
					next({
						...ctx,
						variables: {
							date1,
						},
					})
				},
			},
		}
	}

	const checkVariables: ClientPlugin = () => {
		return {
			network: {
				enter(ctx, { resolve }) {
					spy(marshaledVariables(ctx))
					resolve(ctx, {})
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
		date2: date1.getTime(),
	})
})
