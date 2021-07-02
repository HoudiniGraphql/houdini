// local imports
import fragmentProcessor from './fragment'
import { preprocessorTest } from '../utils'
import '../../../../jest.setup'

describe('fragment preprocessor', function () {
	test('happy path', async function () {
		const doc = await preprocessorTest(`
			<script>
                let reference

				const data = fragment(graphql\`
                    fragment TestFragment on User { 
                        id
                    }
				\`, reference)
			</script>
		`)

		// make sure we added the right stuff
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import _TestFragmentArtifact from "$houdini/artifacts/TestFragment";
		let reference;

		const data = fragment({
		    "kind": "HoudiniFragment",
		    "artifact": _TestFragmentArtifact,
		    "config": houdiniConfig
		}, reference);
	`)
	})
})
