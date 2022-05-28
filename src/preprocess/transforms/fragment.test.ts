// local imports
import { preprocessorTest } from '../utils'
import '../../../jest.setup'

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
		import _TestFragmentStore from "$houdini/stores/GQL_TestFragment";
		import { HoudiniDocumentProxy } from "$houdini";
		let TestFragmentProxy = new HoudiniDocumentProxy();
		let reference;

		const data = fragment({
		    "kind": "HoudiniFragment",
		    "store": _TestFragmentStore,
		    "proxy": TestFragmentProxy,
		    config: houdiniConfig
		}, reference);

		$:
		{
		    TestFragmentProxy.invoke(reference);
		}
	`)
	})

	test('paginated', async function () {
		const doc = await preprocessorTest(`
			<script>
                let reference

				const data = fragment(graphql\`
                    fragment TestFragment on User { 
						friends @paginate { 
							id
						}
                    }
				\`, reference)
			</script>
		`)

		// make sure we added the right stuff
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import _TestFragmentStore from "$houdini/stores/GQL_TestFragment";
		import { HoudiniDocumentProxy } from "$houdini";
		let TestFragmentProxy = new HoudiniDocumentProxy();
		let reference;

		const data = fragment({
		    "kind": "HoudiniFragment",
		    "store": _TestFragmentStore,
		    "proxy": TestFragmentProxy,
		    config: houdiniConfig
		}, reference);

		$:
		{
		    TestFragmentProxy.invoke(reference);
		}
	`)
	})
})
