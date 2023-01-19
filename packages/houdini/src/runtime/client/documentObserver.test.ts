import { sleep } from '@kitql/helper'
import { test, expect, vi, beforeEach } from 'vitest'

import { HoudiniClient } from '.'
import { setMockConfig } from '../lib/config'
import type { GraphQLObject } from '../lib/types'
import { ArtifactKind, DataSource } from '../lib/types'
import type { ClientPlugin } from './documentObserver'
import { DocumentObserver } from './documentObserver'

function createStore(
	plugins: ClientPlugin[],
	fetching: boolean | undefined = undefined
): DocumentObserver<GraphQLObject, Record<string, any>> {
	const client = new HoudiniClient({
		url: 'URL',
	})

	return new DocumentObserver({
		client,
		pipeline: plugins,
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
		fetching,
	})
}

function createStoreMutation(
	plugins: ClientPlugin[]
): DocumentObserver<GraphQLObject, Record<string, any>> {
	const client = new HoudiniClient({
		url: 'URL',
	})

	return new DocumentObserver({
		client,
		pipeline: plugins,
		artifact: {
			kind: ArtifactKind.Mutation,
			hash: '1234',
			raw: 'RAW_TEXT',
			name: 'TestArtifact_Mutation',
			rootType: 'Mutation',
			selection: {},
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
		start(ctx, { next }) {
			tracker(1, 'start')
			next(ctx)
		},
		beforeNetwork(ctx, { next }) {
			tracker(1, 'beforeNetwork')
			next(ctx)
		},
		network(ctx, { next }) {
			tracker(1, 'network')
			next(ctx)
		},
		end(ctx, { resolve }) {
			tracker(1, 'end')
			resolve(ctx)
		},
	})

	const middleware2: ClientPlugin = () => {
		return {
			network(ctx, { next }) {
				tracker(2, 'network')
				next(ctx)
			},
			afterNetwork(ctx, { resolve }) {
				tracker(2, 'afterNetwork')
				resolve(ctx)
			},
			end(ctx, { resolve }) {
				tracker(2, 'end')
				resolve(ctx)
			},
		}
	}

	const terminate: ClientPlugin = () => ({
		start(ctx, { next }) {
			tracker(3, 'start')
			next(ctx)
		},
		beforeNetwork(ctx, { next }) {
			tracker(3, 'beforeNetwork')
			next(ctx)
		},
		network(ctx, { resolve }) {
			tracker(3, 'network')
			resolve(ctx, {
				data: { hello: 'world' },
				errors: [],
				fetching: true,
				partial: false,
				source: DataSource.Cache,
				variables: null,
			})
		},
		afterNetwork(ctx, { resolve }) {
			tracker(3, 'afterNetwork')
			resolve(ctx)
		},
		end(ctx, { resolve }) {
			tracker(3, 'end')
			resolve(ctx)
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
		[1, 'start'],
		[3, 'start'],
		[1, 'beforeNetwork'],
		[3, 'beforeNetwork'],
		[1, 'network'],
		[2, 'network'],
		[3, 'network'],
		[3, 'afterNetwork'],
		[2, 'afterNetwork'],
		[3, 'end'],
		[2, 'end'],
		[1, 'end'],
	])

	// make sure we got the right value back
	expect(value).toEqual({
		data: { hello: 'world' },
		errors: [],
		fetching: true,
		partial: false,
		source: DataSource.Cache,
		variables: null,
	})
})

test('terminate short-circuits pipeline', async function () {
	const history: [number, string][] = []
	const tracker = (which: number, step: string) => {
		history.push([which, step])
	}

	const middleware1: ClientPlugin = () => ({
		start(ctx, { next }) {
			tracker(1, 'start')
			next(ctx)
		},
		end(ctx, { resolve }) {
			tracker(1, 'end')
			resolve(ctx)
		},
		network(ctx, { next }) {
			tracker(1, 'network')
			next(ctx)
		},
	})
	const middleware2: ClientPlugin = () => {
		return {
			beforeNetwork(ctx, { resolve }) {
				tracker(2, 'beforeNetwork')
				resolve(ctx, {
					data: { hello: 'world' },
					errors: [],
					fetching: true,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
			},
			end(ctx, { resolve }) {
				tracker(2, 'end')
				resolve(ctx, {
					data: { hello: 'world' },
					errors: [],
					fetching: true,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
			},
			network(ctx, { next }) {
				tracker(2, 'network')
				next(ctx)
			},
			afterNetwork(ctx, { resolve }) {
				tracker(2, 'afterNetwork')
				resolve(ctx)
			},
		}
	}

	// create the client with the middlewares
	const store = createStore([middleware1, middleware2])

	// kick off the pipeline
	await store.send()

	// make sure we called the hooks in the right order
	expect(history).toEqual([
		[1, 'start'],
		[2, 'beforeNetwork'],
		[2, 'afterNetwork'],
		[2, 'end'],
		[1, 'end'],
	])
})

test('uneven lists phases', async function () {
	const history: [number, string][] = []
	const tracker = (which: number, step: string) => {
		history.push([which, step])
	}

	const middleware1: ClientPlugin = () => ({
		start(ctx, { next }) {
			tracker(1, 'start')
			next(ctx)
		},
		end(ctx, { resolve }) {
			tracker(1, 'end')
			resolve(ctx)
		},
		beforeNetwork(ctx, { next }) {
			tracker(1, 'beforeNetwork')
			next(ctx)
		},
		network(ctx, { resolve }) {
			tracker(1, 'network')
			resolve(ctx, {
				data: { hello: 'world' },
				errors: [],
				fetching: true,
				partial: false,
				source: DataSource.Cache,
				variables: null,
			})
		},
	})
	const middleware2: ClientPlugin = () => {
		return {
			end(ctx, { resolve }) {
				tracker(2, 'end')
				resolve(ctx, {
					data: { hello: 'world' },
					errors: [],
					fetching: true,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
			},
			afterNetwork(ctx, { resolve }) {
				tracker(2, 'afterNetwork')
				resolve(ctx)
			},
		}
	}

	// create the client with the middlewares
	const store = createStore([middleware1, middleware2])

	// kick off the pipeline
	await store.send()

	// make sure we called the hooks in the right order
	expect(history).toEqual([
		[1, 'start'],
		[1, 'beforeNetwork'],
		[1, 'network'],
		[2, 'afterNetwork'],
		[2, 'end'],
		[1, 'end'],
	])
})

test('can call resolve multiple times to set multiple values', async function () {
	const middleware: ClientPlugin = () => ({
		network(ctx, { resolve }) {
			resolve(ctx, {
				data: { hello: 'world' },
				errors: [],
				fetching: true,
				partial: false,
				source: DataSource.Cache,
				variables: null,
			})
			sleep(100).then(() =>
				resolve(ctx, {
					data: { hello: 'another-world' },
					errors: [],
					fetching: true,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
			)
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
		data: { hello: 'world' },
		errors: [],
		fetching: true,
		partial: false,
		source: DataSource.Cache,
		variables: null,
	})
	expect(fn).toHaveBeenNthCalledWith(2, {
		data: { hello: 'world' },
		errors: [],
		fetching: true,
		partial: false,
		source: DataSource.Cache,
		variables: null,
	})
	expect(fn).toHaveBeenNthCalledWith(3, {
		fetching: true,
		partial: false,

		data: { hello: 'another-world' },
		errors: [],
		source: DataSource.Cache,
		variables: null,
	})
})

test('error rejects the promise', async function () {
	const middleware: ClientPlugin = () => ({
		start() {
			throw 'hello'
		},
	})

	// create the client with the middlewares
	const store = createStore([middleware])

	// make sure that the promise rejected with the error value
	await expect(store.send()).rejects.toEqual('hello')
})

test('async error rejects the promise', async function () {
	const middleware: ClientPlugin = () => ({
		async start() {
			throw 'hello'
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
		start(ctx, { next }) {
			ctx.fetchParams = {
				...ctx.fetchParams,
				headers: {
					hello: 'world',
				},
			}
			next(ctx)
		},
	})

	const spy = vi.fn()
	const fetchMiddleware: ClientPlugin = () => ({
		start(ctx, { resolve }) {
			spy(ctx.fetchParams)
			resolve(ctx, {
				data: { hello: 'world' },
				errors: [],
				fetching: true,
				partial: false,
				source: DataSource.Cache,
				variables: null,
			})
		},
	})

	// start the pipeline
	const store = createStore([middleware1, fetchMiddleware])
	await store.send()

	expect(spy).toBeCalledWith({
		headers: { hello: 'world' },
	})
})

test('exit can replay a pipeline', async function () {
	let count = 0

	const replayPlugin: ClientPlugin = () => ({
		end(ctx, { value, next, resolve }) {
			if (value.data?.hello === 'world') {
				count++
				next(ctx)
			} else {
				resolve(ctx, {
					data: { hello: 'another-value' },
					errors: [],
					fetching: true,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
			}
		},
	})

	const source: ClientPlugin = () => ({
		start(ctx, { resolve }) {
			// we have to get here twice to succeed
			if (count) {
				resolve(ctx, {
					data: { hello: 'another-value' },
					errors: [],
					fetching: true,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
				return
			}

			resolve(ctx, {
				data: { hello: 'world' },
				errors: [],
				fetching: true,
				partial: false,
				source: DataSource.Cache,
				variables: null,
			})
		},
	})

	// create the client with the sources
	const store = createStore([replayPlugin, source])

	// make sure that the promise rejected with the error value
	await expect(store.send()).resolves.toEqual({
		data: { hello: 'another-value' },
		errors: [],
		fetching: true,
		partial: false,
		source: DataSource.Cache,
		variables: null,
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
			async start(ctx, { next }) {
				// assign the new variables
				ctx.variables = {
					...ctx.variables,
					date1,
				}

				// move on
				next(ctx)
			},
		}
	}

	const checkVariables: ClientPlugin = () => {
		return {
			network(ctx, { resolve, marshalVariables }) {
				spy(marshalVariables(ctx))
				resolve(ctx, {
					data: { hello: 'world' },
					errors: [],
					fetching: true,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
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
			start(ctx, { next, variablesChanged }) {
				spy(variablesChanged(ctx))
				next(ctx)
			},
			network(ctx, { resolve }) {
				resolve(ctx, {
					data: { hello: 'world' },
					errors: [],
					fetching: true,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
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
			start(ctx, { next, variablesChanged }) {
				ctx.variables = {
					...ctx.variables,
					count: 0,
				}
				spy(variablesChanged(ctx))
				next(ctx)
			},
			network(ctx, { resolve }) {
				resolve(ctx, {
					data: { hello: 'world' },
					errors: [],
					fetching: true,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
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
			start(ctx, { next, variablesChanged }) {
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
			network(ctx, { resolve }) {
				resolve(ctx, {
					data: { hello: 'world' },
					errors: [],
					fetching: true,
					partial: false,
					source: DataSource.Cache,
					variables: null,
				})
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

test('can set observer state from hook', async function () {
	const updateMiddleware: ClientPlugin = () => ({
		start(ctx, { next, updateState }) {
			updateState((old) => ({ ...old, data: { loading: true } }))
			next(ctx)
		},
		network(ctx, { resolve }) {
			resolve(ctx, {
				data: { hello: 'test' },
				errors: null,
				fetching: true,
				partial: false,
				source: DataSource.Network,
				variables: null,
			})
		},
	})

	// create a store we will test against
	const store = createStore([updateMiddleware])

	// listen for updates to the state
	const spy = vi.fn()
	store.subscribe(spy)

	// kick off the pipeline
	await store.send()

	// the first updated state is the null state
	// the second should contain the value we set
	expect(spy).toHaveBeenNthCalledWith(2, {
		data: { loading: true },
		errors: null,
		fetching: true,
		partial: false,
		source: null,
		variables: null,
	})

	// the third should have the final result
	expect(spy).toHaveBeenNthCalledWith(3, {
		data: { hello: 'test' },
		errors: null,
		fetching: true,
		partial: false,
		source: DataSource.Network,
		variables: null,
	})
})

test("sending a setup message doesn't trigger the network steps", async function () {
	const history: [number, string][] = []
	const tracker = (which: number, step: string) => {
		history.push([which, step])
	}

	const middleware1: ClientPlugin = () => ({
		start(ctx, { next }) {
			tracker(1, 'start')
			next(ctx)
		},
		afterNetwork(ctx, { next }) {
			tracker(1, 'network')
			next(ctx)
		},
		end(ctx, { resolve }) {
			tracker(1, 'end')
			resolve(ctx)
		},
	})
	const middleware2: ClientPlugin = () => {
		return {
			end(ctx, { resolve }) {
				tracker(2, 'end')
				resolve(ctx)
			},
			network(ctx, { next }) {
				tracker(2, 'network')
				next(ctx)
			},
			afterNetwork(ctx, { resolve }) {
				tracker(2, 'afterNetwork')
				resolve(ctx)
			},
		}
	}

	const terminate: ClientPlugin = () => ({
		start(ctx, { next }) {
			tracker(3, 'start')
			next(ctx)
		},
		network(ctx, { resolve }) {
			tracker(3, 'network')
			resolve(ctx, {
				data: { hello: 'world' },
				errors: [],
				fetching: true,
				partial: false,
				source: DataSource.Cache,
				variables: null,
			})
		},
		afterNetwork(ctx, { resolve }) {
			tracker(3, 'afterNetwork')
			resolve(ctx)
		},
		end(ctx, { resolve }) {
			tracker(3, 'end')
			resolve(ctx)
		},
	})

	// create the client with the middlewares
	const store = createStore([middleware1, middleware2, terminate])

	// spy on the subscribe function
	const subscribeSpy = vi.fn()
	store.subscribe(subscribeSpy)

	// kick off the pipeline
	const value = await store.send({ setup: true })

	// make sure we called the hooks in the right order
	expect(history).toEqual([
		[1, 'start'],
		[3, 'start'],
		[3, 'end'],
		[2, 'end'],
		[1, 'end'],
	])
})

test('in a query, if fetching is set to false, return with false', async function () {
	const fakeFetch: ClientPlugin = () => ({
		network(ctx, { resolve }) {
			resolve(ctx, {
				data: { hello: 'world' },
				errors: [],
				fetching: true,
				partial: false,
				source: DataSource.Cache,
				variables: null,
			})
		},
	})

	// create a store we will test against
	const store = createStore([fakeFetch], false)

	// listen for updates to the state
	const spy = vi.fn()
	store.subscribe(spy)

	// kick off the pipeline
	await store.send()

	// check the fetching value
	expect(spy).toHaveBeenNthCalledWith(1, {
		data: null,
		errors: null,
		fetching: false,
		partial: false,
		source: null,
		variables: null,
	})
})

test('in a mutation, fetching should be false', async function () {
	const fakeFetch: ClientPlugin = () => ({
		network(ctx, { resolve }) {
			resolve(ctx, {
				data: { hello: 'world' },
				errors: [],
				fetching: true,
				partial: false,
				source: DataSource.Cache,
				variables: null,
			})
		},
	})

	// create a store we will test against
	const store = createStoreMutation([fakeFetch])

	// listen for updates to the state
	const spy = vi.fn()
	store.subscribe(spy)

	// kick off the pipeline
	await store.send()

	// check the fetching value
	expect(spy).toHaveBeenNthCalledWith(1, {
		data: null,
		errors: null,
		fetching: false,
		partial: false,
		source: null,
		variables: null,
	})
})
