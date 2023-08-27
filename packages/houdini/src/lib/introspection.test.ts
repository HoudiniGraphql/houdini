import { describe, expect, test } from 'vitest'

import { extractHeaders, extractHeadersStr } from './introspection'

describe('extractHeaders', () => {
	test('undefined', function () {
		expect(extractHeaders()).toStrictEqual({})
	})

	test('empty', function () {
		expect(extractHeaders([])).toStrictEqual({})
	})

	test('one', function () {
		expect(extractHeaders(['Authorization="Bearer MyToken"'])).toStrictEqual({
			Authorization: 'Bearer MyToken',
		})
	})

	test('two', function () {
		expect(extractHeaders(['Authorization="Bearer MyToken"', 'yop=ok'])).toStrictEqual({
			Authorization: 'Bearer MyToken',
			yop: 'ok',
		})
	})
})

describe('extractHeadersStr', () => {
	test('undefined', function () {
		expect(extractHeadersStr(undefined)).toStrictEqual({})
	})

	test('empty', function () {
		expect(extractHeadersStr('')).toStrictEqual({})
	})

	test('two', function () {
		expect(extractHeadersStr('Authorization="Bearer MyToken" yop=ok')).toStrictEqual({
			Authorization: 'Bearer MyToken',
			yop: 'ok',
		})
	})
})
