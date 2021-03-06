// external imports
import * as svelte from 'svelte/compiler'
import * as graphql from 'graphql'
// local imports
import fragmentProcessor from './fragment'
import { hashDocument, testConfig } from 'houdini-common'
import importArtifact from '../utils/importArtifact'
import '../../../../jest.setup'
import { DocumentArtifact } from 'houdini'
// mock out the walker so that imports don't actually happen
jest.mock('../utils/importArtifact')

beforeEach(() => {
	// @ts-ignore
	// Clear all instances and calls to constructor and all methods:
	importArtifact.mockClear()
})

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
		import _TestFragmentArtifact from "$houdini/artifacts/TestFragment.cjs";
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

	// grab the content between graphql``
	const after = content.substr(content.indexOf('graphql`') + 'graphql`'.length)
	const query = after.substr(0, after.indexOf('`'))

	const parsedQuery = graphql.parse(query)

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
	// mock the import statement
	importArtifact.mockImplementation(function (): DocumentArtifact {
		return {
			name: 'TestFragment',
			kind: 'HoudiniFragment',
			raw: query,
			hash: hashDocument(parsedQuery),
			rootType: 'User',
			selection: {
				id: { key: 'id', type: 'ID' },
			},
		}
	})

	// @ts-ignore
	// run the source through the processor
	await fragmentProcessor(config, doc)

	// invoke the test
	return doc
}
