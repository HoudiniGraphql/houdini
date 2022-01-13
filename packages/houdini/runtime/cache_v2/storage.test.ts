import { InMemoryStorage, OperationKind } from './storage'

describe('in memory layers', function () {
	test('first layer written can be looked up', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// create the layer and write some data
		const layer = storage.createLayer()
		layer.writeField('User:1', 'firstName', 'John')

		// can get the data back
		expect(storage.get('User:1', 'firstName')).toEqual('John')
		expect(storage.layerCount).toEqual(1)
	})

	test('non-optimistic layer overwrites base', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// create the two layers and write overlapping data
		storage.writeField('User:1', 'firstName', 'John')
		storage.writeField('User:1', 'firstName', 'Marshal')

		// can get the data back
		expect(storage.get('User:1', 'firstName')).toEqual('Marshal')
		expect(storage.layerCount).toEqual(1)
	})

	test('optimistic layer overwrites base', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// create the two layers and write overlapping data
		storage.writeField('User:1', 'firstName', 'John')
		storage.createLayer(true).writeField('User:1', 'firstName', 'Marshal')

		// can get the data back
		expect(storage.get('User:1', 'firstName')).toEqual('Marshal')
		expect(storage.layerCount).toEqual(2)
	})

	test('resolving layer merges into base', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// write the layer
		storage.writeField('User:1', 'firstName', 'John')
		expect(storage.get('User:1', 'firstName')).toEqual('John')
		expect(storage.layerCount).toEqual(1)

		// add an optimistic layer
		const optimisticLayer = storage.createLayer(true)
		optimisticLayer.writeField('User:1', 'firstName', 'Marshal')

		// sanity check
		expect(storage.get('User:1', 'firstName')).toEqual('Marshal')
		expect(storage.layerCount).toEqual(2)

		// resolve the middle layer with different data
		optimisticLayer.writeField('User:1', 'firstName', 'Mike')
		storage.resolveLayer(optimisticLayer.id)

		// make sure the layer was committed correctly
		expect(storage.get('User:1', 'firstName')).toEqual('Mike')
		expect(storage.layerCount).toEqual(1)
	})

	test('resolving layer merges up', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// write the layer
		storage.writeField('User:1', 'firstName', 'John')

		// write an optimistic layer above the base
		const layer1 = storage.createLayer(true)
		layer1.writeField('User:1', 'firstName', 'Michael')

		// add a layer above it
		const layer2 = storage.createLayer()
		layer2.writeField('User:1', 'firstName', 'Jeremy')
		layer2.writeField('User:1', 'lastName', 'Michelson')

		// sanity check
		expect(storage.get('User:1', 'firstName')).toEqual('Jeremy')
		expect(storage.layerCount).toEqual(3)

		// flatten the data down to a single layer
		layer1.writeField('User:1', 'firstName', 'Michael')
		layer1.writeField('User:1', 'lastName', "George'")
		layer1.writeField('User:1', 'age', 5)
		storage.resolveLayer(layer1.id)

		// make sure the data is what we expect
		expect(storage.layerCount).toEqual(1)
		expect(storage.get('User:1', 'age')).toEqual(5)
		expect(storage.get('User:1', 'firstName')).toEqual('Jeremy')
		expect(storage.get('User:1', 'lastName')).toEqual('Michelson')
	})

	test('can write links', function () {
		const storage = new InMemoryStorage()
		storage.writeLink('User:1', 'bestFriend', 'User:2')
		expect(storage.get('User:1', 'bestFriend')).toEqual('User:2')
	})

	test('can write list of links', function () {
		const storage = new InMemoryStorage()
		storage.writeLink('User:1', 'friends', ['User:1'])
		expect(storage.get('User:1', 'friends')).toEqual(['User:1'])
	})

	describe('operations', function () {
		test('optimistic deletes', function () {
			const storage = new InMemoryStorage()

			// add some information on the base layer we will delete
			storage.writeField('User:1', 'firstName', 'John')
			storage.writeField('User:1', 'lastName', 'Schmidt')

			// create a layer that deletes the record
			const middleLayer = storage.createLayer(true)
			middleLayer.writeOperation({ kind: OperationKind.delete, target: 'User:1' })

			// add some more information for the record
			storage.writeField('User:1', 'middleName', 'Jingleheymer')

			// we should be able to retrieve the top layer of information
			expect(storage.get('User:1', 'middleName')).toEqual('Jingleheymer')

			// and the information in the lower layer should be inaccessible
			expect(storage.get('User:1', 'firstName')).toBeUndefined()
			expect(storage.get('User:1', 'lastName')).toBeUndefined()

			// resolving the middle layer should delete the information
			storage.resolveLayer(middleLayer.id)
			expect(storage.layerCount).toEqual(1)
			expect(storage.get('User:1', 'firstName')).toBeUndefined()
			expect(storage.get('User:1', 'lastName')).toBeUndefined()
			expect(storage.get('User:1', 'middleName')).toEqual('Jingleheymer')
		})
	})
})

/// Notes:
///
/// - a layer has to be completely cleared before values are reolved. if User:1 got a bunch of
///   values from the the layer but things resolved with User:2, we need to forget the User:1
///   values
