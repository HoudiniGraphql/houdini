import { sleep } from '@kitql/helper'
import { test, expect, vi } from 'vitest'

import { ArtifactKind } from '../lib/types'
import { HoudiniClient } from './'
import { DocumentObserver, HoudiniMiddleware } from './networkMiddleware'

function createStore(middlewares: HoudiniMiddleware[]): DocumentObserver<any, any> {
	return new HoudiniClient({ middlewares }).observe({
		kind: ArtifactKind.Query,
		hash: '1234',
		raw: 'RAW_TEXT',
		name: 'TestArtifact',
		rootType: 'Query',
		selection: {},
	})
}

test('middleware pipeline happy path', async function () {
	const history: [number, string][] = []
	const tracker = (which: number, step: string) => {
		history.push([which, step])
	}

	const middleware1: HoudiniMiddleware = () => ({
		phaseOne: {
			enter(ctx, { next }) {
				tracker(1, 'one_enter')
				next(ctx)
			},
			exit(ctx, next) {
				tracker(1, 'one_exit')
				next(ctx)
			},
		},
		phaseTwo: {
			enter(ctx, { next }) {
				tracker(1, 'two_enter')
				next(ctx)
			},
		},
	})
	const middleware2: HoudiniMiddleware = () => {
		return {
			phaseOne: {
				exit(ctx, next) {
					tracker(2, 'one_exit')
					next(ctx)
				},
			},
			phaseTwo: {
				enter(ctx, { next }) {
					tracker(2, 'two_enter')
					next(ctx)
				},
				exit(ctx, next) {
					tracker(2, 'two_exit')
					next(ctx)
				},
			},
		}
	}

	const terminate: HoudiniMiddleware = () => ({
		phaseOne: {
			enter(ctx, { next }) {
				tracker(3, 'one_enter')
				next(ctx)
			},
			exit(ctx, next) {
				tracker(3, 'one_exit')
				next(ctx)
			},
		},
		phaseTwo: {
			enter(ctx, { terminate }) {
				tracker(3, 'two_enter')
				terminate(ctx, 'value')
			},
			exit(ctx, next) {
				tracker(3, 'two_exit')
				next(ctx)
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
	expect(value).toEqual('value')
	// make sure we updated the store state
	expect(subscribeSpy).toHaveBeenCalledWith('value')
})

test('terminate short-circuits pipeline', async function () {
	const history: [number, string][] = []
	const tracker = (which: number, step: string) => {
		history.push([which, step])
	}

	const middleware1: HoudiniMiddleware = () => ({
		phaseOne: {
			enter(ctx, { next }) {
				tracker(1, 'one_enter')
				next(ctx)
			},
			exit(ctx, next) {
				tracker(1, 'one_exit')
				next(ctx)
			},
		},
		phaseTwo: {
			enter(ctx, { next }) {
				tracker(1, 'two_enter')
				next(ctx)
			},
		},
	})
	const middleware2: HoudiniMiddleware = () => {
		return {
			phaseOne: {
				enter(ctx, { terminate }) {
					tracker(2, 'one_enter')
					terminate(ctx, 'value')
				},
				exit(ctx, next) {
					tracker(2, 'one_exit')
					next(ctx, 'value')
				},
			},
			phaseTwo: {
				enter(ctx, { next }) {
					tracker(2, 'two_enter')
					next(ctx)
				},
				exit(ctx, next) {
					tracker(2, 'two_exit')
					next(ctx)
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

test('can call terminate multiple times to set multiple values', async function () {
	const middleware: HoudiniMiddleware = () => ({
		phaseOne: {
			enter(ctx, { terminate }) {
				terminate(ctx, 'value')
				sleep(100).then(() => terminate(ctx, 'another-value'))
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
	expect(result).toEqual('value')
	// that value will be the second value to the spy
	expect(fn).toHaveBeenNthCalledWith(2, 'value')
	// and the third call will be the second call to terminate
	expect(fn).toHaveBeenNthCalledWith(3, 'another-value')
})

test('error can replay chain', async function () {
	let count = 0

	// we want to make sure that the errors dont bubble up beyond the middleware that
	// traps it
	const outerSpy = vi.fn()
	const spy = vi.fn()

	const firstErrorHandler: HoudiniMiddleware = () => ({
		error(ctx) {
			outerSpy()
		},
	})

	const errorTrapper: HoudiniMiddleware = () => ({
		error(ctx, { next, error }) {
			// invoke the spy (we got here once)
			spy(error)

			// try again but this time, succeed
			count++
			next(ctx)
		},
	})

	const middleware: HoudiniMiddleware = () => ({
		phaseOne: {
			enter(ctx, { terminate }) {
				// we have to get here twice to succeed
				if (count) {
					terminate(ctx, 'value')
					return
				}

				throw 'hello'
			},
		},
	})

	// create the client with the middlewares
	const store = createStore([firstErrorHandler, errorTrapper, middleware])

	// make sure that the promise rejected with the error value
	await expect(store.send()).resolves.toEqual('value')
	expect(spy).toHaveBeenCalled()
	expect(outerSpy).not.toHaveBeenCalled()
})

test('error rejects the promise', async function () {
	const middleware: HoudiniMiddleware = () => ({
		phaseOne: {
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
	const middleware: HoudiniMiddleware = () => ({
		phaseOne: {
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

	const middleware: HoudiniMiddleware = () => ({
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
	const middleware1: HoudiniMiddleware = () => ({
		phaseOne: {
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
	const fetchMiddleware: HoudiniMiddleware = () => ({
		phaseOne: {
			enter(ctx, { terminate }) {
				spy(ctx.fetchParams)
				terminate(ctx, 'value')
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
