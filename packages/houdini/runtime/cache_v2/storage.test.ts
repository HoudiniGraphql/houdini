import { InMemoryStorage, link } from './storage'

describe('in memory layers', function () {
	test('first layer written can be looked up', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// create the layer and write some data
		const layer = storage.createLayer()
		layer.write('User:1', 'firstName', 'John')

		// can get the data back
		expect(storage.get('User:1', 'firstName')).toEqual('John')
		expect(storage.layerCount).toEqual(1)
	})

	test('non-optimistic layer overwrites base', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// create the two layers and write overlapping data
		storage.write('User:1', 'firstName', 'John')
		storage.write('User:1', 'firstName', 'Marshal')

		// can get the data back
		expect(storage.get('User:1', 'firstName')).toEqual('Marshal')
		expect(storage.layerCount).toEqual(1)
	})

	test('optimistic layer overwrites base', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// create the two layers and write overlapping data
		storage.write('User:1', 'firstName', 'John')
		storage.createLayer(true).write('User:1', 'firstName', 'Marshal')

		// can get the data back
		expect(storage.get('User:1', 'firstName')).toEqual('Marshal')
		expect(storage.layerCount).toEqual(2)
	})

	test('resolving layer merges into base', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// write the layer
		storage.write('User:1', 'firstName', 'John')
		expect(storage.get('User:1', 'firstName')).toEqual('John')
		expect(storage.layerCount).toEqual(1)

		// add an optimistic layer
		const optimisticLayer = storage.createLayer(true)
		optimisticLayer.write('User:1', 'firstName', 'Marshal')

		// sanity check
		expect(storage.get('User:1', 'firstName')).toEqual('Marshal')
		expect(storage.layerCount).toEqual(2)

		// resolve the middle layer with different data
		storage.resolveLayer(optimisticLayer.id, {
			fields: {
				'User:1': {
					firstName: 'Mike',
				},
			},
		})

		// make sure the layer was committed correctly
		expect(storage.get('User:1', 'firstName')).toEqual('Mike')
		expect(storage.layerCount).toEqual(1)
	})

	test('resolving layer merges up', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// write the layer
		storage.write('User:1', 'firstName', 'John')

		// write an optimistic layer above the base
		const layer1 = storage.createLayer(true)
		layer1.write('User:1', 'firstName', 'Michael')

		// add a layer above it
		const layer2 = storage.createLayer()
		layer2.write('User:1', 'firstName', 'Jeremy')
		layer2.write('User:1', 'lastName', 'Michelson')

		// sanity check
		expect(storage.get('User:1', 'firstName')).toEqual('Jeremy')
		expect(storage.layerCount).toEqual(3)

		// flatten the data down to a single layer
		storage.resolveLayer(layer1.id, {
			fields: {
				'User:1': {
					firstName: 'Michael',
					lastName: 'George',
					age: 5,
				},
			},
		})

		// make sure the data is what we expect
		expect(storage.layerCount).toEqual(1)
		expect(storage.get('User:1', 'age')).toEqual(5)
		expect(storage.get('User:1', 'firstName')).toEqual('Jeremy')
		expect(storage.get('User:1', 'lastName')).toEqual('Michelson')
	})

	test('can write and retrieve links', function () {
		const storage = new InMemoryStorage()

		storage.write('User:1', 'bestFriend', link('User:2'))

		expect(storage.get('User:1', 'bestFriend')).toEqual(link('User:2'))
	})
})
