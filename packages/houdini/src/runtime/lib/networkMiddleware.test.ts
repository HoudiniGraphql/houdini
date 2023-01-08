import { sleep } from '@kitql/helper'
import { test, expect, vi } from 'vitest'

import { HoudiniClient } from './network'
import { HoudiniMiddleware } from './networkMiddleware'
import { DocumentArtifact, ArtifactKind } from './types'

const artifact: DocumentArtifact = {
	kind: ArtifactKind.Query,
	hash: '1234',
	raw: 'RAW_TEXT',
	name: 'TestArtifact',
	rootType: 'Query',
	selection: {},
}

test('middleware pipeline happy path', async function () {
	const history: [number, string][] = []
	const tracker = (which: number, step: string) => {
		history.push([which, step])
	}

	const middleware1: HoudiniMiddleware = () => ({
		phaseOne: {
			enter(ctx, { next }) {
				tracker(1, 'setup_enter')
				next(ctx)
			},
			exit(ctx, next) {
				tracker(1, 'setup_exit')
				next(ctx)
			},
		},
		phaseTwo: {
			enter(ctx, { next }) {
				tracker(1, 'fetch_enter')
				next(ctx)
			},
		},
	})
	const middleware2: HoudiniMiddleware = () => {
		return {
			phaseOne: {
				exit(ctx, next) {
					tracker(2, 'setup_exit')
					next(ctx)
				},
			},
			phaseTwo: {
				enter(ctx, { next }) {
					tracker(2, 'fetch_enter')
					next(ctx)
				},
				exit(ctx, next) {
					tracker(2, 'fetch_exit')
					next(ctx)
				},
			},
		}
	}

	const terminate: HoudiniMiddleware = () => ({
		phaseOne: {
			enter(ctx, { next }) {
				tracker(3, 'setup_enter')
				next(ctx)
			},
			exit(ctx, next) {
				tracker(3, 'setup_exit')
				next(ctx)
			},
		},
		phaseTwo: {
			enter(ctx, { terminate }) {
				tracker(3, 'fetch_enter')
				terminate(ctx, 'value')
			},
			exit(ctx, next) {
				tracker(3, 'fetch_exit')
				next(ctx)
			},
		},
	})

	// create the client with the middlewares
	const client = new HoudiniClient({ middlewares: [middleware1, middleware2, terminate] })

	// create a store we can subscribe to
	const store = client.observe(artifact)

	// spy on the subscribe function
	const subscribeSpy = vi.fn()
	store.subscribe(subscribeSpy)

	// kick off the pipeline
	const value = await store.send()

	// make sure we called the hooks in the right order
	expect(history).toEqual([
		[1, 'setup_enter'],
		[3, 'setup_enter'],
		[1, 'fetch_enter'],
		[2, 'fetch_enter'],
		[3, 'fetch_enter'],
		[3, 'fetch_exit'],
		[2, 'fetch_exit'],
		[3, 'setup_exit'],
		[2, 'setup_exit'],
		[1, 'setup_exit'],
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
				tracker(1, 'setup_enter')
				next(ctx)
			},
			exit(ctx, next) {
				tracker(1, 'setup_exit')
				next(ctx)
			},
		},
		phaseTwo: {
			enter(ctx, { next }) {
				tracker(1, 'fetch_enter')
				next(ctx)
			},
		},
	})
	const middleware2: HoudiniMiddleware = () => {
		return {
			phaseOne: {
				enter(ctx, { terminate }) {
					tracker(2, 'setup_enter')
					terminate(ctx, 'value')
				},
				exit(ctx, next) {
					tracker(2, 'setup_exit')
					next(ctx, 'value')
				},
			},
			phaseTwo: {
				enter(ctx, { next }) {
					tracker(2, 'fetch_enter')
					next(ctx)
				},
				exit(ctx, next) {
					tracker(2, 'fetch_exit')
					next(ctx)
				},
			},
		}
	}

	// create the client with the middlewares
	const client = new HoudiniClient({ middlewares: [middleware1, middleware2] })

	// kick off the pipeline
	await client.observe(artifact).send()

	// make sure we called the hooks in the right order
	expect(history).toEqual([
		[1, 'setup_enter'],
		[2, 'setup_enter'],
		[2, 'setup_exit'],
		[1, 'setup_exit'],
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
	const client = new HoudiniClient({ middlewares: [middleware] })

	// create the store and subscribe to the value
	const store = client.observe(artifact)
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
	const client = new HoudiniClient({ middlewares: [firstErrorHandler, errorTrapper, middleware] })

	// make sure that the promise rejected with the error value
	await expect(client.observe(artifact).send()).resolves.toEqual('value')
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
	const client = new HoudiniClient({ middlewares: [middleware] })

	// make sure that the promise rejected with the error value
	await expect(client.observe(artifact).send()).rejects.toEqual('hello')
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
	const client = new HoudiniClient({ middlewares: [middleware] })

	// make sure that the promise rejected with the error value
	await expect(client.observe(artifact).send()).rejects.toEqual('hello')
})
