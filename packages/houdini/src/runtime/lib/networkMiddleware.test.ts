import { test, expect, vi } from 'vitest'

import cache from '../cache'
import { HoudiniClient } from './network'
import { ObserverMiddleware } from './networkMiddleware'
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

	const iterable = (() => {
		const list = [1, 2, 3]
		const i = 0
		const state = null

		return {
			next(args) {
				list[i + 1].enter(args, {
					next() {},
				})
			},
		}
	})()

	const middleware1: ObserverMiddleware = () => ({
		setup: {
			enter(ctx, { next }) {
				tracker(1, 'setup_enter')
				next(ctx)
			},
			exit(ctx, { next }) {
				tracker(1, 'setup_exit')
				next(ctx)
			},
		},
		fetch: {
			enter(ctx, { next }) {
				tracker(1, 'fetch_enter')
				next(ctx)
			},
		},
	})
	const middleware2: ObserverMiddleware = () => {
		return {
			setup: {
				exit(ctx, next) {
					tracker(2, 'setup_exit')
					next(ctx)
				},
			},
			fetch: {
				enter(ctx, { next }) {
					tracker(2, 'fetch_enter')
					next(ctx)
				},
				exit(ctx, { next }) {
					tracker(2, 'fetch_exit')
					next(ctx)
				},
			},
		}
	}

	const terminate: ObserverMiddleware = () => ({
		setup: {
			enter(ctx, { next }) {
				tracker(3, 'setup_enter')

				next(ctx)
			},
			exit(ctx, { next }) {
				tracker(3, 'setup_exit')
				next(ctx)
			},
		},
		fetch: {
			enter(ctx, { terminate }) {
				terminate('value')

				window.onEvent((msg) => {
					terminate(msg)
				})
			},
			exit(ctx, { next }) {
				tracker(3, 'fetch_exit')
				next(ctx)
			},
		},
	})

	// create the client with the middlewares
	const client = new HoudiniClient({ middlewares: [middleware1, middleware2, terminate] })

	// kick off the pipeline
	const value = await client.observe(artifact).send()

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

	expect(value).toEqual('value')
})
