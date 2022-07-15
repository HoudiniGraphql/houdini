// local imports
import '../../../jest.setup'
import { preprocessorTest } from '../utils'

describe('module preprocessor checker', function () {
	test('operation in wrong script (module)', async function () {
		try {
			const doc = await preprocessorTest(
				`
				<script context="module">
				const { data } = query(graphql\`
				query TestQuery {
					viewer {
						id
					}
				}
				\`)
				</script>
				`
			)
		} catch (error) {
			expect(error).toMatchInlineSnapshot(
				`
			{
			    "filepath": "/home/jycouet/udev/gh/lib/houdini/src/routes/component.svelte",
			    "message": "The operation \\"TestQuery\\" should not be defined in a context=\\"module\\"."
			}
		`
			)
		}
	})
})
