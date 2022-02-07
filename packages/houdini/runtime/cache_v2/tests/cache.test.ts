// external imports
import { testConfig } from 'houdini-common'
// locals
import { Cache } from '../cache'

const config = testConfig()

test('write selection to root', function () {
	// instantiate a cache we'll test against
	const cache = new Cache(config)

	// save the data
	const data = {
		viewer: {
			id: '1',
			firstName: 'bob',
		},
	}
	const selection = {
		viewer: {
			type: 'User',
			keyRaw: 'viewer',
			fields: {
				id: {
					type: 'ID',
					keyRaw: 'id',
				},
				firstName: {
					type: 'String',
					keyRaw: 'firstName',
				},
			},
		},
	}
	cache.writeSelection({
		selection,
		data,
	})

	// make sure we can get back what we wrote
	expect(
		cache.getSelection({
			selection,
		})
	).toEqual({
		viewer: {
			id: '1',
			firstName: 'bob',
		},
	})
})

test.todo('can write to and resolve layers')

test.todo("resolving a layer with the same value as the most recent doesn't notify subscribers")
