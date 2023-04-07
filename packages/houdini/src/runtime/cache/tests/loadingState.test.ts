import { test, expect } from 'vitest'

import { testConfigFile } from '../../../test'
import type { SubscriptionSelection } from '../../lib'
import { LoadingValue } from '../../lib'
import { Cache } from '../cache'

const config = testConfigFile()

test('can generate loading state with nested objects', function () {
	// instantiate the cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'User',
				keyRaw: 'viewer',
				visible: true,
				loading: { kind: 'continue' },
				selection: {
					fields: {
						id: {
							keyRaw: 'id',
							type: 'String',
							visible: true,
							loading: { kind: 'value' },
						},
						parent: {
							type: 'User',
							keyRaw: 'parent',
							visible: true,
							loading: { kind: 'continue' },
							selection: {
								fields: {
									id: {
										type: 'ID',
										visible: true,
										keyRaw: 'id',
									},
									firstName: {
										type: 'String',
										visible: true,
										keyRaw: 'firstName',
										loading: { kind: 'value' },
									},
									friend: {
										type: 'User',
										keyRaw: 'friend',
										visible: true,
										loading: { kind: 'value' },
										selection: {
											fields: {
												id: {
													type: 'ID',
													visible: true,
													keyRaw: 'id',
												},
												firstName: {
													type: 'String',
													visible: true,
													keyRaw: 'firstName',
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	expect(
		cache.read({
			selection,
			loading: true,
		})
	).toEqual({
		partial: false,
		stale: false,
		data: {
			viewer: {
				id: LoadingValue,
				parent: {
					firstName: LoadingValue,
					friend: LoadingValue,
				},
			},
		},
	})
})

test('can generate loading state with lists', function () {
	// instantiate the cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			users: {
				type: 'User',
				keyRaw: 'users',
				visible: true,
				loading: { kind: 'continue', list: { count: 5, depth: 1 } },
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
						firstName: {
							type: 'String',
							visible: true,
							keyRaw: 'firstName',
							loading: { kind: 'value' },
						},
					},
				},
			},
		},
	}

	expect(
		cache.read({
			selection,
			loading: true,
		})
	).toEqual({
		partial: false,
		stale: false,
		data: {
			users: [
				{
					firstName: LoadingValue,
				},
				{
					firstName: LoadingValue,
				},
				{
					firstName: LoadingValue,
				},
				{
					firstName: LoadingValue,
				},
				{
					firstName: LoadingValue,
				},
			],
		},
	})
})

test('can generate loading state with multi-dimensional lists', function () {
	// instantiate the cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			users: {
				type: 'User',
				keyRaw: 'users',
				visible: true,
				loading: { kind: 'continue', list: { count: 5, depth: 2 } },
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
						firstName: {
							type: 'String',
							visible: true,
							keyRaw: 'firstName',
							loading: { kind: 'value' },
						},
					},
				},
			},
		},
	}

	expect(
		cache.read({
			selection,
			loading: true,
		})
	).toEqual({
		partial: false,
		stale: false,
		data: {
			users: [
				[
					{
						firstName: LoadingValue,
					},
					{
						firstName: LoadingValue,
					},
					{
						firstName: LoadingValue,
					},
					{
						firstName: LoadingValue,
					},
					{
						firstName: LoadingValue,
					},
				],
			],
		},
	})
})

test('can generate loading state with lists of loading values', function () {
	// instantiate the cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			users: {
				type: 'User',
				keyRaw: 'users',
				visible: true,
				loading: { kind: 'value', list: { count: 5, depth: 1 } },
				selection: {
					fields: {
						id: {
							type: 'ID',
							visible: true,
							keyRaw: 'id',
						},
						firstName: {
							type: 'String',
							visible: true,
							keyRaw: 'firstName',
						},
					},
				},
			},
		},
	}

	expect(
		cache.read({
			selection,
			loading: true,
		})
	).toEqual({
		partial: false,
		stale: false,
		data: {
			users: [LoadingValue, LoadingValue, LoadingValue, LoadingValue, LoadingValue],
		},
	})
})

test('generate abstract loading states', function () {
	// instantiate the cache
	const cache = new Cache(config)

	const selection: SubscriptionSelection = {
		fields: {
			viewer: {
				type: 'User',
				keyRaw: 'viewer',
				visible: true,
				loading: { kind: 'continue' },
				selection: {
					loadingTypes: ['User', 'Cat'],
					abstractFields: {
						typeMap: {},
						fields: {
							User: {
								id: {
									keyRaw: 'id',
									type: 'String',
									visible: true,
								},
								parent: {
									type: 'User',
									keyRaw: 'parent',
									visible: true,
									loading: { kind: 'value' },
								},
							},
							Cat: {
								id: {
									keyRaw: 'id',
									type: 'String',
									visible: true,
								},
								name: {
									type: 'String',
									keyRaw: 'name',
									visible: true,
									loading: { kind: 'value' },
								},
							},
						},
					},
				},
			},
		},
	}

	expect(
		cache.read({
			selection,
			loading: true,
		})
	).toEqual({
		partial: false,
		stale: false,
		data: {
			viewer: {
				name: LoadingValue,
				parent: LoadingValue,
			},
		},
	})
})
