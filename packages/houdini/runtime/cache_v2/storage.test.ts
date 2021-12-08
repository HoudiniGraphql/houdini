import { InMemoryStorage } from './storage'

describe('in memory layers', function () {
	test('first layer written can be looked up', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// write the layer
		storage.write({
			layer: {
				'User:1': {
					firstName: 'John',
				},
			},
		})

		// can get the data back
		expect(storage.read('User:1', 'firstName')).toEqual('John')
		expect(storage.layerCount).toEqual(1)
	})

	test('non-optimistic layer overwrites base', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// write the layer
		storage.write({
			layer: {
				'User:1': {
					firstName: 'John',
				},
			},
		})
		storage.write({
			layer: {
				'User:1': {
					firstName: 'Marshal',
				},
			},
		})

		// can get the data back
		expect(storage.read('User:1', 'firstName')).toEqual('Marshal')
		expect(storage.layerCount).toEqual(1)
	})

	test('optimistic layer overwrites base', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// write the layer
		storage.write({
			layer: {
				'User:1': {
					firstName: 'John',
				},
			},
		})
		storage.write({
			layer: {
				'User:1': {
					firstName: 'Marshal',
				},
			},
			optimistic: true,
		})

		// can get the data back
		expect(storage.read('User:1', 'firstName')).toEqual('Marshal')
		expect(storage.layerCount).toEqual(2)
	})

	test('resolving layer merges into base', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// write the layer
		storage.write({
			layer: {
				'User:1': {
					firstName: 'John',
				},
			},
		})
		expect(storage.read('User:1', 'firstName')).toEqual('John')
		expect(storage.layerCount).toEqual(1)

		const layerID = storage.write({
			layer: {
				'User:1': {
					firstName: 'Marshal',
				},
			},
			optimistic: true,
		})
		expect(storage.read('User:1', 'firstName')).toEqual('Marshal')
		expect(storage.layerCount).toEqual(2)

		// resolve the layer with different data
		storage.resolveLayer(layerID, {
			'User:1': {
				firstName: 'Mike',
			},
		})

		// make sure the layer was committed correctly
		expect(storage.read('User:1', 'firstName')).toEqual('Mike')
		expect(storage.layerCount).toEqual(1)
	})
})
