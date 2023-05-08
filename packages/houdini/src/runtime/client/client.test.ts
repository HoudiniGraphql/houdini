import { expect, vi, test } from 'vitest'

import { DataSource } from '../lib'
import type { ClientPlugin } from './documentStore'
import { createStore } from './documentStore.test'

test('createPluginHooks', async function () {
	const enter = vi.fn()
	const create = vi.fn()

	const plugins: ClientPlugin[] = [
		() => [
			{
				start(ctx, { next }) {
					enter(1)
					next(ctx)
				},
			},
		],
		() => ({
			start(ctx, { next }) {
				enter(2)
				next(ctx)
			},
		}),
		() => [
			{
				start(ctx, { next }) {
					enter(3)
					next(ctx)
				},
			},
			{
				start(ctx, { next }) {
					enter(4)
					next(ctx)
				},
			},
			() => {
				create(1)
				return [
					{
						start(ctx, { next }) {
							enter(5)
							next(ctx)
						},
					},
					{
						start(ctx, { next }) {
							enter(6)
							next(ctx)
						},
					},
					() => {
						create(2)
						return [
							{
								start(ctx, { next }) {
									enter(7)
									next(ctx)
								},
							},
							{
								start(ctx, { resolve }) {
									enter(8)
									resolve(ctx, {
										fetching: false,
										variables: {},
										data: null,
										errors: [],
										partial: false,
										stale: false,
										source: DataSource.Cache,
									})
								},
							},
						]
					},
				]
			},
		],
	]

	// create a document store out of the plugins
	const store = createStore(plugins)

	// go through the pipeline
	await store.send()

	// make sure the spies were call with the correct history
	expect(enter).toHaveBeenNthCalledWith(1, 1)
	expect(enter).toHaveBeenNthCalledWith(2, 2)
	expect(enter).toHaveBeenNthCalledWith(3, 3)
	expect(enter).toHaveBeenNthCalledWith(4, 4)
	expect(enter).toHaveBeenNthCalledWith(5, 5)
	expect(enter).toHaveBeenNthCalledWith(6, 6)
	expect(enter).toHaveBeenNthCalledWith(7, 7)
	expect(enter).toHaveBeenNthCalledWith(8, 8)

	expect(create).toHaveBeenNthCalledWith(1, 1)
	expect(create).toHaveBeenNthCalledWith(2, 2)
})
