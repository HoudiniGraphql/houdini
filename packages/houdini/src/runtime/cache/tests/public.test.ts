import { test, expect } from 'vitest'

import { testConfigFile } from '../../../test'
import { Cache, rootID } from '../cache'
import { CacheProxy } from '../publicWrapper'

const testCache = () => new CacheProxy(new Cache(testConfigFile()))

test('must have schema information to set field', function () {
	const cache = testCache()
	expect(() => cache.root.set({ field: 'test', value: 1 })).toThrowError()
})

test('must have schema information to read field', function () {
	const cache = testCache()
	expect(() => cache.root.get({ field: 'test' })).toThrowError()
})

test('can set root field value to scalar', function () {
	const cache = testCache()

	// we'll need to provide the type information
	cache.setFieldType({
		parent: rootID,
		key: 'test',
		type: 'Int',
		nullable: true,
	})

	// update the cached value
	cache.root.set({
		field: 'test',
		value: 1,
	})

	// read the value
	expect(
		cache._internal_unstable.read({
			selection: {
				test: {
					keyRaw: 'test',
					type: 'Int',
				},
			},
		}).data
	).toEqual({
		test: 1,
	})
})

test('can read root field value', function () {
	const cache = testCache()

	// we'll need to provide the type information
	cache.setFieldType({
		parent: rootID,
		key: 'test',
		type: 'Int',
		nullable: true,
	})

	// update the cached value
	cache.root.set({
		field: 'test',
		value: 1,
	})

	// read the value
	expect(cache.root.get({ field: 'test' })).toEqual(1)
})

test('can set custom scalar value', function () {
	const cache = testCache()

	const targetDate = new Date()

	// we'll need to provide the type information
	cache.setFieldType({
		parent: rootID,
		key: 'test',
		type: 'DateTime',
		nullable: true,
	})

	// update the cached value
	cache.root.set({
		field: 'test',
		value: targetDate,
	})

	// look up the value the "normal" way to ensure we marshaled the date
	expect(
		cache._internal_unstable.read({
			selection: {
				test: {
					keyRaw: 'test',
					type: 'DateTime',
				},
			},
		}).data
	).toEqual({
		test: targetDate,
	})
})

test('can read custom scalar value', function () {
	const cache = testCache()

	const targetDate = new Date()

	// we'll need to provide the type information
	cache.setFieldType({
		parent: rootID,
		key: 'test',
		type: 'DateTime',
		nullable: true,
	})

	// write the scalar value to the layer directly
	cache._internal_unstable._internal_unstable.storage.topLayer.writeField(
		rootID,
		'test',
		targetDate.getTime()
	)

	// read the cached value
	expect(cache.root.get({ field: 'test' })).toEqual(targetDate)
})
