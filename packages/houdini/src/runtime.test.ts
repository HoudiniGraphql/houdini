// externals
import { Patch } from 'houdini-compiler'
// locals
import { applyPatch } from './runtime'

describe('apply patch', function () {
	test('base case', function () {
		// grab the value of mutationName.{field} and apply it to the object at the
		// root of the payload under the field target
		const patch: Patch = {
			fields: {},
			edges: {
				mutationName: {
					fields: {
						field: [['target']],
					},
					edges: {},
				},
			},
		}

		// a function to spy on the update
		const set = jest.fn()

		// the current data
		const current = {
			target: 'hello',
		}
		// the mutation payload
		const payload = {
			mutationName: {
				field: 'world',
			},
		}

		// apply the patch
		applyPatch(patch, set, current, payload)

		// make sure we got the expected value
		expect(set).toHaveBeenCalledWith({
			target: 'world',
		})
	})
})
