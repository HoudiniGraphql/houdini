import { test, expect, describe } from 'vitest'

import { InMemoryStorage, OperationLocation } from '../storage'

describe('in memory layers', function () {
	test('first layer written can be looked up', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// create the layer and write some data
		const layer = storage.createLayer()
		layer.writeField('User:1', 'firstName', 'John')

		// can get the data back
		expect(storage.get('User:1', 'firstName')).toEqual({
			value: 'John',
			displayLayers: [layer.id],
			kind: 'scalar',
		})
		expect(storage.layerCount).toEqual(1)
	})

	test('non-optimistic layer overwrites base', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// create the two layers and write overlapping data
		storage.writeField('User:1', 'firstName', 'John')
		const layerID = storage.writeField('User:1', 'firstName', 'Marshal')

		// can get the data back
		expect(storage.get('User:1', 'firstName')).toEqual({
			value: 'Marshal',
			displayLayers: [layerID],
			kind: 'scalar',
		})
		expect(storage.layerCount).toEqual(1)
	})

	test('optimistic layer overwrites base', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// create the two layers and write overlapping data
		storage.writeField('User:1', 'firstName', 'John')
		const optimisticLayerID = storage
			.createLayer(true)
			.writeField('User:1', 'firstName', 'Marshal')

		// can get the data back
		expect(storage.get('User:1', 'firstName')).toEqual({
			value: 'Marshal',
			kind: 'scalar',
			displayLayers: [optimisticLayerID],
		})
		expect(storage.layerCount).toEqual(2)
	})

	test('resolving layer merges into base', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// write the layer
		const baseLayerID = storage.writeField('User:1', 'firstName', 'John')
		expect(storage.get('User:1', 'firstName')).toEqual({
			value: 'John',
			displayLayers: [baseLayerID],
			kind: 'scalar',
		})
		expect(storage.layerCount).toEqual(1)

		// add an optimistic layer
		const optimisticLayer = storage.createLayer(true)
		optimisticLayer.writeField('User:1', 'firstName', 'Marshal')

		// sanity check
		expect(storage.get('User:1', 'firstName')).toEqual({
			value: 'Marshal',
			kind: 'scalar',
			displayLayers: [optimisticLayer.id],
		})
		expect(storage.layerCount).toEqual(2)

		// resolve the middle layer with different data
		optimisticLayer.writeField('User:1', 'firstName', 'Mike')
		storage.resolveLayer(optimisticLayer.id)

		// make sure the layer was committed correctly
		expect(storage.get('User:1', 'firstName')).toEqual({
			value: 'Mike',
			displayLayers: [baseLayerID],
			kind: 'scalar',
		})
		expect(storage.layerCount).toEqual(1)
	})

	test('resolving layer merges up', function () {
		// instantiate an storage layer with an in-memory layer
		const storage = new InMemoryStorage()

		// write the layer
		const baseLayerID = storage.writeField('User:1', 'firstName', 'John')

		// write an optimistic layer above the base
		const layer1 = storage.createLayer(true)
		layer1.writeField('User:1', 'firstName', 'Michael')

		// add a layer above it
		const layer2 = storage.createLayer()
		layer2.writeField('User:1', 'firstName', 'Jeremy')
		layer2.writeField('User:1', 'lastName', 'Michelson')

		// sanity check
		expect(storage.get('User:1', 'firstName')).toEqual({
			value: 'Jeremy',
			displayLayers: [layer2.id],
			kind: 'scalar',
		})
		expect(storage.layerCount).toEqual(3)

		// flatten the data down to a single layer
		layer1.writeField('User:1', 'firstName', 'Michael')
		layer1.writeField('User:1', 'lastName', "George'")
		layer1.writeField('User:1', 'age', 5)
		storage.resolveLayer(layer1.id)

		// make sure the data is what we expect
		expect(storage.layerCount).toEqual(1)
		expect(storage.get('User:1', 'age')).toEqual({
			value: 5,
			displayLayers: [baseLayerID],
			kind: 'scalar',
		})
		expect(storage.get('User:1', 'firstName')).toEqual({
			value: 'Jeremy',
			displayLayers: [baseLayerID],
			kind: 'scalar',
		})
		expect(storage.get('User:1', 'lastName')).toEqual({
			value: 'Michelson',
			displayLayers: [baseLayerID],
			kind: 'scalar',
		})
	})

	test('can write links', function () {
		const storage = new InMemoryStorage()
		const layerID = storage.writeLink('User:1', 'bestFriend', 'User:2')
		expect(storage.get('User:1', 'bestFriend')).toEqual({
			value: 'User:2',
			displayLayers: [layerID],
			kind: 'link',
		})
	})

	test('can write list of links', function () {
		const storage = new InMemoryStorage()
		const layerID = storage.writeLink('User:1', 'friends', ['User:1'])
		expect(storage.get('User:1', 'friends')).toEqual({
			value: ['User:1'],
			displayLayers: [layerID],
			kind: 'link',
		})
	})

	test('values are reset when layer is cleared', function () {
		const storage = new InMemoryStorage()
		const layer = storage.createLayer(true)

		layer.writeField('User:1', 'firstName', 'Alec')

		// sanity check
		expect(storage.get('User:1', 'firstName')).toEqual({
			value: 'Alec',
			displayLayers: [layer.id],
			kind: 'scalar',
		})

		// clear the layer
		layer.clear()

		// make sure we dont have any data back
		expect(storage.get('User:1', 'firstName').value).toBeUndefined()
	})

	test('can overwrite deletes for a specific link list', function () {
		const storage = new InMemoryStorage()

		// add a base layer with some value
		storage.writeLink('User:1', 'friends', ['User:2'])

		// add an optimistic layer that deletes the first entry
		const layer = storage.createLayer(true)
		layer.delete('User:2')

		// make sure its removed
		expect(storage.get('User:1', 'friends').value).toEqual([])

		// resolve the optimistic layer
		storage.resolveLayer(layer.id)
		// sanity check
		expect(storage.get('User:1', 'friends').value).toEqual([])

		// add the entry back to the list
		storage.writeLink('User:1', 'friends', ['User:2'])

		expect(storage.get('User:1', 'friends').value).toEqual(['User:2'])
	})

	test('deleting specific fields removes the field', function () {
		const storage = new InMemoryStorage()

		// write some data to the storage we will delete
		storage.writeField('User:1', 'firstName', 'Michael')
		storage.writeField('User:1', 'lastName', 'Aivazis')

		expect(storage.get('User:1', 'firstName')).toEqual({
			value: 'Michael',
			displayLayers: [storage.topLayer.id],
			kind: 'scalar',
		})

		// delete the value
		storage.deleteField('User:1', 'firstName')
		storage.topLayer.removeUndefinedFields()

		// look up the value now that it's been deleted
		expect(storage.get('User:1', 'firstName')).toEqual({
			value: undefined,
			displayLayers: [],
			kind: 'unknown',
		})

		// make sure that the top layer doesn't actually hold the value
		expect(Object.keys(storage.topLayer.fields['User:1'])).toEqual(['lastName'])
	})

	test('deleting all fields of a record deletes the record', function () {
		const storage = new InMemoryStorage()

		// write some data to the storage we will delete
		storage.writeField('User:1', 'firstName', 'Michael')

		expect(storage.get('User:1', 'firstName')).toEqual({
			value: 'Michael',
			displayLayers: [storage.topLayer.id],
			kind: 'scalar',
		})

		// delete the value
		storage.deleteField('User:1', 'firstName')
		storage.topLayer.removeUndefinedFields()

		// look up the value now that it's been deleted
		expect(storage.get('User:1', 'firstName')).toEqual({
			value: undefined,
			displayLayers: [],
			kind: 'unknown',
		})

		// make sure that the top layer doesn't actually hold the value
		expect(storage.topLayer.fields['User:1']).toBeUndefined()
	})

	test('create and resolve on base layer', function () {
		// note: this situation happens if a mutation fires before any queries
		// are sent to the server to create a non-optimistic layer

		const storage = new InMemoryStorage()

		// create an optimistic layer
		const layer = storage.createLayer(true)

		layer.writeField('User:1', 'firstName', 'bob')

		// resolve the layer
		storage.resolveLayer(layer.id)

		expect(storage.get('User:1', 'firstName').value).toEqual('bob')
	})

	test.todo('links are reset when layer is cleared')

	describe('operations', function () {
		test('optimistic deletes', function () {
			const storage = new InMemoryStorage()

			// add some information on the base layer we will delete
			storage.writeField('User:1', 'firstName', 'John')
			storage.writeField('User:1', 'lastName', 'Schmidt')

			// add the user we're going to delete to a linked list to make sure they are removed from it
			const baseLayerID = storage.writeLink('User:2', 'friends', ['User:1', 'User:3'])

			// create a layer that deletes the record
			const middleLayer = storage.createLayer(true)
			middleLayer.delete('User:1')

			// add some more information for the record
			const topLayerID = storage.writeField('User:1', 'middleName', 'Jingleheymer')

			// we should be able to retrieve the top layer of information
			expect(storage.get('User:1', 'middleName')).toEqual({
				value: 'Jingleheymer',
				displayLayers: [topLayerID],
				kind: 'scalar',
			})
			expect(storage.get('User:2', 'friends')).toEqual({
				value: ['User:3'],
				kind: 'link',
				displayLayers: [middleLayer.id, baseLayerID],
			})

			// and the information in the lower layer should be inaccessible
			expect(storage.get('User:1', 'firstName').value).toBeUndefined()
			expect(storage.get('User:1', 'lastName').value).toBeUndefined()

			// resolving the middle layer should delete the information even if its different
			// than the original source
			middleLayer.clear()
			middleLayer.delete('User:3')
			storage.resolveLayer(middleLayer.id)

			expect(storage.layerCount).toEqual(1)

			// the original fields of User:1 should still exist
			expect(storage.get('User:1', 'firstName')).toEqual({
				value: 'John',
				displayLayers: [baseLayerID],
				kind: 'scalar',
			})
			expect(storage.get('User:1', 'lastName')).toEqual({
				value: 'Schmidt',
				displayLayers: [baseLayerID],
				kind: 'scalar',
			})
			expect(storage.get('User:1', 'middleName')).toEqual({
				value: 'Jingleheymer',
				displayLayers: [baseLayerID],
				kind: 'scalar',
			})
			expect(storage.get('User:2', 'friends')).toEqual({
				value: ['User:1'],
				displayLayers: [baseLayerID],
				kind: 'link',
			})
		})

		test('insert into linked list', function () {
			const storage = new InMemoryStorage()

			// add a linked list that we will append to in an optimistic layer
			const baseLayerID = storage.writeLink('User:1', 'friends', ['User:2'])

			// create an optimistic layer and insert a new friend
			const layer = storage.createLayer(true)
			layer.insert('User:1', 'friends', OperationLocation.end, 'User:3')

			// insert some more records in a non-optimistic layer
			storage.insert('User:1', 'friends', OperationLocation.end, 'User:5')

			// make sure we got the full list back
			expect(storage.get('User:1', 'friends')).toEqual({
				value: ['User:2', 'User:3', 'User:5'],
				displayLayers: [storage.topLayer.id, layer.id, baseLayerID],
				kind: 'link',
			})

			// simulate a mutation response with different data (clear the layer, add a new record, and resolve it)
			layer.clear()
			layer.insert('User:1', 'friends', OperationLocation.end, 'User:4')
			storage.resolveLayer(layer.id)

			// look up the linked list
			expect(storage.get('User:1', 'friends')).toEqual({
				value: ['User:2', 'User:5', 'User:4'],
				displayLayers: [baseLayerID],
				kind: 'link',
			})
			// there should only be one layer
			expect(storage.layerCount).toEqual(1)
		})

		test('remove from linked list', function () {
			const storage = new InMemoryStorage()

			// add a linked list we will remove from in a layer
			const baseLayerID = storage.writeLink('User:1', 'friends', [
				'User:2',
				'User:3',
				'User:4',
			])

			// create an optimistic layer we will use to mutate the list
			const layer = storage.createLayer(true)
			layer.remove('User:1', 'friends', 'User:2')

			// make sure we removed the user from the list
			expect(storage.get('User:1', 'friends')).toEqual({
				value: ['User:3', 'User:4'],
				displayLayers: [layer.id, baseLayerID],
				kind: 'link',
			})

			// simulate a mutation response with different data (clear the layer, remove a different one, and resolve it)
			layer.clear()
			layer.remove('User:1', 'friends', 'User:4')
			layer.remove('User:1', 'friends', 'User:3')
			storage.resolveLayer(layer.id)

			// make sure we got the correct final result
			expect(storage.get('User:1', 'friends')).toEqual({
				value: ['User:2'],
				displayLayers: [baseLayerID],
				kind: 'link',
			})
			expect(storage.layerCount).toEqual(1)
		})

		test.todo(
			'resolving layer with deletes and fields removes old data and retains the new stuff'
		)

		test.todo('an optimistic layer after a stack non-optimistic survives resolution')
	})
})
