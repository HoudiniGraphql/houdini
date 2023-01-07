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
