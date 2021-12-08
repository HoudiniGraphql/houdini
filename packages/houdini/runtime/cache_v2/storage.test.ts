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
		expect(storage.get('User:1', 'firstName')).toEqual('John')
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
		expect(storage.get('User:1', 'firstName')).toEqual('Marshal')
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
		expect(storage.get('User:1', 'firstName')).toEqual('Marshal')
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
		expect(storage.get('User:1', 'firstName')).toEqual('John')
		expect(storage.layerCount).toEqual(1)

		const layerID = storage.write({
			layer: {
				'User:1': {
					firstName: 'Marshal',
				},
			},
			optimistic: true,
		})
		expect(storage.get('User:1', 'firstName')).toEqual('Marshal')
		expect(storage.layerCount).toEqual(2)

		// resolve the layer with different data
		storage.resolveLayer(layerID, {
			'User:1': {
				firstName: 'Mike',
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
		storage.write({
			layer: {
				'User:1': {
					firstName: 'John',
				},
			},
		})
		expect(storage.get('User:1', 'firstName')).toEqual('John')
		expect(storage.layerCount).toEqual(1)

		// write an optimistic layer above the base
		const layer1 = storage.write({
			layer: {
				'User:1': {
					firstName: 'Michael',
				},
			},
			optimistic: true,
		})

		// add a layer above it that we will resolve
		const layer2 = storage.write({
			layer: {
				'User:1': {
					firstName: 'Mitch',
					lastName: 'Michelson',
				},
			},
			optimistic: true,
		})
		// and a layer above that we want to merge into
		storage.write({
			layer: {
				'User:1': {
					firstName: 'Jeremy',
				},
			},
		})
		expect(storage.get('User:1', 'firstName')).toEqual('Jeremy')
		expect(storage.layerCount).toEqual(4)

		storage.resolveLayer(layer2, {
			'User:1': {
				firstName: 'Mitch2',
				lastName: 'Michelson2',
			},
		})

		expect(storage.get('User:1', 'firstName')).toEqual('Jeremy')
		expect(storage.get('User:1', 'lastName')).toEqual('Michelson2')
		expect(storage.layerCount).toEqual(3)

		// flatten the data down to a single layer
		storage.resolveLayer(layer1, {
			'User:1': {
				firstName: 'Michael',
				lastName: 'George',
				age: 5,
			},
		})

		// make sure the data is what we expect
		expect(storage.layerCount).toEqual(1)
		expect(storage.get('User:1', 'age')).toEqual(5)
		expect(storage.get('User:1', 'firstName')).toEqual('Jeremy')
		expect(storage.get('User:1', 'lastName')).toEqual('Michelson2')
	})
})
