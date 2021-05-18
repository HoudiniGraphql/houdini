// external imports
import * as svelte from 'svelte/compiler'
// local imports
import fragmentProcessor from './fragment'
import { testConfig } from 'houdini-common'
import '../../../../jest.setup.cjs'

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
		expect(doc.instance.content).toMatchInlineSnapshot(`
		import _TestFragmentArtifact from "$houdini/artifacts/TestFragment";
		let reference;

		const data = fragment({
		    "kind": "HoudiniFragment",
		    "artifact": _TestFragmentArtifact
		}, reference);
	`)
	})
})

async function preprocessorTest(content: string) {
	const schema = `
		type User {
			id: ID!
		}
        
	`

	// parse the document
	const parsed = svelte.parse(content)

	// build up the document we'll pass to the processor
	const config = testConfig({ schema, verifyHash: false })

	const doc = {
		instance: parsed.instance,
		module: parsed.module,
		config,
		dependencies: [],
		filename: 'base.svelte',
	}

	// @ts-ignore
	// run the source through the processor
	await fragmentProcessor(config, doc)

	// invoke the test
	return doc
}
