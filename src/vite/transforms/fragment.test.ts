// local imports
import { component_test } from '../tests'
import '../../../jest.setup'

describe('fragment preprocessor', function () {
	test('happy path', async function () {
		const doc = await component_test(`
            let reference

            const data = fragment(graphql\`
                fragment TestFragment on User { 
                    id
                }
            \`, reference)
		`)

		// make sure we added the right stuff
		expect(doc).toMatchInlineSnapshot(`
		import _TestFragmentArtifact from "$houdini/artifacts/TestFragment";
		import _TestFragmentStore from "$houdini/stores/TestFragment";
		import { HoudiniDocumentProxy } from "$houdini/runtime/lib/proxy";
		let TestFragmentProxy = new HoudiniDocumentProxy();
		let reference;

		const data = fragment({
		    "kind": "HoudiniFragment",
		    "store": _TestFragmentStore,
		    "artifact": _TestFragmentArtifact,
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
		const doc = await component_test(`
            let reference

            const data = fragment(graphql\`
                fragment TestFragment on User { 
                    friends @paginate { 
                        id
                    }
                }
            \`, reference)
		`)

		// make sure we added the right stuff
		expect(doc).toMatchInlineSnapshot(`
		import _TestFragmentArtifact from "$houdini/artifacts/TestFragment";
		import _TestFragmentStore from "$houdini/stores/TestFragment";
		import { HoudiniDocumentProxy } from "$houdini/runtime/lib/proxy";
		let TestFragmentProxy = new HoudiniDocumentProxy();
		let reference;

		const data = fragment({
		    "kind": "HoudiniFragment",
		    "store": _TestFragmentStore,
		    "artifact": _TestFragmentArtifact,
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
