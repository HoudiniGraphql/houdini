// locals
import { flattenFragments, Document } from './compile'

test('happy path', function () {
	// build up the list of dependents
	const fragments = {
		A: ['B', 'C'],
		B: ['B', 'C'],
		C: ['D'],
	}

	// the document we are flattening
	const doc = {
		requiredFragments: ['A'],
	}

	// make sure we get the expected value
})
