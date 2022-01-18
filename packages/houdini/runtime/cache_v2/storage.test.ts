import { InMemoryStorage, OperationKind, OperationLocation } from './storage'

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

	test('values are reset when layer is cleared', function () {
		const storage = new InMemoryStorage()
		const layer = storage.createLayer(true)

		layer.writeField('User:1', 'firstName', 'Alec')

		// sanity check
		expect(storage.get('User:1', 'firstName')).toEqual('Alec')

		// clear the layer
		layer.clear()

		// make sure we dont have any data back
		expect(storage.get('User:1', 'firstName')).toBeUndefined()
	})

	test.todo('links are reset when layer is cleared')

	describe('operations', function () {
		test('optimistic deletes', function () {
			const storage = new InMemoryStorage()

			// add some information on the base layer we will delete
			storage.writeField('User:1', 'firstName', 'John')
			storage.writeField('User:1', 'lastName', 'Schmidt')

			// add the user we're going to delete to a linked list to make sure they are removed from it
			storage.writeLink('User:2', 'friends', ['User:1'])

			// create a layer that deletes the record
			const middleLayer = storage.createLayer(true)
			middleLayer.delete('User:1')

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
			expect(storage.get('User:2', 'friends')).toEqual([])
		})

		test('insert into linked list', function () {
			const storage = new InMemoryStorage()

			// add a linked list that we will append to in an optimistic layer
			storage.writeLink('User:1', 'friends', ['User:2'])

			// create an optimistic layer and insert a new friend
			const layer = storage.createLayer(true)
			layer.insert('User:1', 'friends', OperationLocation.end, 'User:3')

			// insert some more records in a non-optimistic layer
			storage.insert('User:1', 'friends', OperationLocation.end, 'User:5')

			// make sure we got the full list back
			expect(storage.get('User:1', 'friends')).toEqual(['User:2', 'User:3', 'User:5'])

			// simulate a mutation response with different data (clear the layer, add a new record, and resolve it)
			layer.clear()
			layer.insert('User:1', 'friends', OperationLocation.end, 'User:4')
			layer.insert('User:1', 'friends', OperationLocation.end, 'User:5')
			storage.resolveLayer(layer.id)

			// look up the linked list
			expect(storage.get('User:1', 'friends')).toEqual(['User:2', 'User:4', 'User:5'])
			// there should only be one layer
			expect(storage.layerCount).toEqual(1)
		})

		test('remove from linked list', function () {
			const storage = new InMemoryStorage()

			// add a linked list we will remove from in a layer
			storage.writeLink('User:1', 'friends', ['User:2', 'User:3', 'User:4'])

			// create an optimistic layer we will use to mutate the list
			const layer = storage.createLayer(true)
			layer.remove('User:1', 'friends', 'User:2')

			// make sure we removed the user from the list
			expect(storage.get('User:1', 'friends')).toEqual(['User:3', 'User:4'])

			// simulate a mutation response with different data (clear the layer, remove a different one, and resolve it)
			layer.clear()
			layer.remove('User:1', 'friends', 'User:4')
			layer.remove('User:1', 'friends', 'User:3')
			storage.resolveLayer(layer.id)

			// make sure we got the correct final result
			expect(storage.get('User:1', 'friends')).toEqual(['User:2'])
			expect(storage.layerCount).toEqual(1)
		})
	})
})
