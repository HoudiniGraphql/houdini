import { test, expect, describe } from 'vitest'

import { deepMerge } from './utils'

describe('deep merge', function () {
	test('non-conflicting keys', function () {
		const one = {
			hello: 'world',
		}
		const two = {
			goodbye: 'moon',
		}

		expect(deepMerge('', one, two)).toEqual({
			hello: 'world',
			goodbye: 'moon',
		})
	})

	test('nested objects', function () {
		const one = {
			hello: {
				message: 'world',
			},
		}
		const two = {
			hello: {
				anotherMessage: 'moon',
			},
		}
		expect(deepMerge('', one, two)).toEqual({
			hello: {
				message: 'world',
				anotherMessage: 'moon',
			},
		})
	})

	test('conflicting keys - same value', function () {
		const one = {
			hello: 'world',
		}
		const two = {
			hello: 'world',
		}
		expect(deepMerge('', one, two)).toEqual({
			hello: 'world',
		})
	})

	test('conflicting keys - different value', function () {
		const one = {
			hello: 'world',
		}
		const two = {
			hello: 'moon',
		}
		expect(() => deepMerge('', one, two)).toThrow()
	})

	test('three-way merge', function () {
		const one = {
			message1: 'hello world',
		}
		const two = {
			message2: 'goodbye moon',
		}
		const three = {
			message3: "i don't know",
		}

		expect(deepMerge('', one, two, three)).toEqual({
			message1: 'hello world',
			message2: 'goodbye moon',
			message3: "i don't know",
		})
	})

	test('three way deep nested', function () {
		const one = {
			message1: 'hello world',
			nested: {
				nestedMessage1: 'another world',
			},
		}
		const two = {
			message2: 'goodbye moon',
			nested: {
				inner: {
					innerMessage2: 'yet another moon',
				},
			},
		}
		const three = {
			message3: "i don't know",
			nested: {
				nestedMessage3: 'another uncertainty',
				inner: {
					innerMessage3: 'yet another uncertainty',
				},
			},
		}

		expect(deepMerge('', one, two, three)).toEqual({
			message1: 'hello world',
			message2: 'goodbye moon',
			message3: "i don't know",
			nested: {
				nestedMessage1: 'another world',
				nestedMessage3: 'another uncertainty',
				inner: {
					innerMessage2: 'yet another moon',
					innerMessage3: 'yet another uncertainty',
				},
			},
		})
	})
})
