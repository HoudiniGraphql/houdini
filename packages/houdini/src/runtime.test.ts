// externals
import { Interaction } from 'houdini-compiler'
// locals
import { applyInteraction } from './runtime'

describe('apply interaction', function () {
	test('base case', function () {
		// grab the value of mutationName.{field} and apply it to the object at the
		// root of the payload under the field target
		const interaction: Interaction = {
			scalars: {},
			edges: {
				mutationName: {
					scalars: {
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

		// apply the interaction
		applyInteraction(interaction, set, current, payload)

		// make sure we got the expected value
		expect(current.target).toEqual('world')
	})
})
