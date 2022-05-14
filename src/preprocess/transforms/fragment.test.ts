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
		import _TestFragmentStore from "$houdini/artifacts/TestFragment";
		import { HoudiniDocumentProxy } from "$houdini";
		let TestFragmentProxy = new HoudiniDocumentProxy();
		let reference;

		const data = fragment({
		    "kind": "HoudiniFragment",
		    "artifact": _TestFragmentArtifact,
		    "config": houdiniConfig,
		    "proxy": TestFragmentProxy
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
		import _TestFragment_Pagination_QueryStore from "$houdini/artifacts/TestFragment_Pagination_Query";
		import _TestFragmentStore from "$houdini/artifacts/TestFragment";
		import { HoudiniDocumentProxy } from "$houdini";
		let TestFragmentProxy = new HoudiniDocumentProxy();
		let reference;

		const data = fragment({
		    "kind": "HoudiniFragment",
		    "artifact": _TestFragmentArtifact,
		    "config": houdiniConfig,
		    "proxy": TestFragmentProxy,
		    "paginationArtifact": TestFragment_Pagination_Query
		}, reference);

		$:
		{
		    TestFragmentProxy.invoke(reference);
		}
	`)
	})
})
