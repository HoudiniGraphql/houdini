import { test, expect, describe } from 'vitest'

import { defaultConfigValues } from './config.js'
import { coerceFormData } from './formData.js'
import type { InputObject } from './types.js'

const config = defaultConfigValues({
	scalars: {
		DateTime: {
			type: 'Date',
			unmarshal(val: number): Date {
				return new Date(val)
			},
			marshal(date: Date): number {
				return date.getTime()
			},
		},
	},
})

const input: InputObject = {
	fields: {
		name: 'String',
		age: 'Int',
		score: 'Float',
		active: 'Boolean',
		role: 'UserRole', // enum
		createdAt: 'DateTime', // custom scalar
		tags: 'String', // list via tags[]
		avatar: 'Upload', // file
		address: 'AddressInput', // nested input object
	},
	types: {
		AddressInput: {
			city: 'String',
			zip: 'Int',
		},
	},
	defaults: {},
	runtimeScalars: {},
}

function form(entries: Array<[string, string | Blob]>): FormData {
	const data = new FormData()
	for (const [key, value] of entries) {
		data.append(key, value)
	}
	return data
}

describe('coerceFormData', () => {
	test('coerces built-in scalars to transport types', () => {
		const result = coerceFormData(
			form([
				['name', 'Alice'],
				['age', '30'],
				['score', '9.5'],
				['active', 'on'],
			]),
			input,
			config
		)
		expect(result).toEqual({ name: 'Alice', age: 30, score: 9.5, active: true })
	})

	test('absent checkbox becomes false', () => {
		const result = coerceFormData(form([['name', 'Alice']]), input, config)
		expect(result.active).toBe(false)
	})

	test('empty string is null for numbers and enums, kept for String', () => {
		const result = coerceFormData(
			form([
				['name', ''],
				['age', ''],
				['role', ''],
			]),
			input,
			config
		)
		expect(result.name).toBe('')
		expect(result.age).toBe(null)
		expect(result.role).toBe(null)
	})

	test('enums pass through as strings', () => {
		const result = coerceFormData(form([['role', 'ADMIN']]), input, config)
		expect(result.role).toBe('ADMIN')
	})

	test('custom scalars are unmarshaled to rich values', () => {
		const result = coerceFormData(form([['createdAt', '1700000000']]), input, config)
		expect(result.createdAt).toBeInstanceOf(Date)
		expect((result.createdAt as Date).getTime()).toBe(1700000000)
	})

	test('scalar lists via the [] convention', () => {
		const result = coerceFormData(
			form([
				['tags[]', 'a'],
				['tags[]', 'b'],
			]),
			input,
			config
		)
		expect(result.tags).toEqual(['a', 'b'])
	})

	test('nested input objects via the dot convention', () => {
		const result = coerceFormData(
			form([
				['address.city', 'NYC'],
				['address.zip', '10001'],
			]),
			input,
			config
		)
		expect(result.address).toEqual({ city: 'NYC', zip: 10001 })
	})

	test('File/Blob values pass through untouched', () => {
		const blob = new Blob(['hi'], { type: 'text/plain' })
		const result = coerceFormData(form([['avatar', blob]]), input, config)
		expect(result.avatar).toBeInstanceOf(Blob)
	})

	test('unknown fields (e.g. hidden markers) are dropped', () => {
		const result = coerceFormData(
			form([
				['name', 'Alice'],
				['__houdini_form', 'CreateUser'],
			]),
			input,
			config
		)
		expect(result).not.toHaveProperty('__houdini_form')
	})

	test('an @endpoint(fields:) allowlist drops in-schema fields not on the list', () => {
		// `age` is a real input field, but absent from the allowlist → it must not be
		// accepted from the POST (over-posting / mass-assignment mitigation)
		const result = coerceFormData(
			form([
				['name', 'Alice'],
				['age', '99'],
			]),
			input,
			config,
			['name']
		)
		expect(result).toEqual({ name: 'Alice', active: false })
		expect(result).not.toHaveProperty('age')
	})

	test('the allowlist keeps nested and list paths that are listed', () => {
		const result = coerceFormData(
			form([
				['address.city', 'NYC'],
				['address.zip', '10001'],
				['tags[]', 'a'],
			]),
			input,
			config,
			['address.city', 'tags[]']
		)
		expect(result.address).toEqual({ city: 'NYC' }) // zip dropped, not on the list
		expect(result.tags).toEqual(['a'])
	})
})
