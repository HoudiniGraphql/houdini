// external imports
import * as svelte from 'svelte/compiler'
import * as graphql from 'graphql'
// local imports
import subscriptionProcessor from './subscription'
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

describe('subscription preprocessor', function () {
	test('happy path', async function () {
		const doc = await preprocessorTest(`
			<script>
				const data = subscription(graphql\`
                    subscription TestSubscription { 
                        newUser { 
                            user { 
                                id
                            }
                        }
                    }
				\`, variables)
			</script>
		`)

		// make sure we added the right stuff
		expect(doc.instance.content).toMatchInlineSnapshot(`
		import _TestSubscriptionArtifact from "$houdini/artifacts/TestSubscription";

		const data = subscription({
		    "kind": "HoudiniSubscription",
		    "artifact": _TestSubscriptionArtifact
		}, variables);
	`)
	})
})

async function preprocessorTest(content: string) {
	// parse the document
	const parsed = svelte.parse(content)

	// grab the content between graphql``
	const after = content.substr(content.indexOf('graphql`') + 'graphql`'.length)
	const query = after.substr(0, after.indexOf('`'))

	const parsedQuery = graphql.parse(query)

	// build up the document we'll pass to the processor
	const config = testConfig({ verifyHash: false })

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
			name: 'TestSubscription',
			kind: 'HoudiniSubscription',
			raw: query,
			hash: hashDocument(parsedQuery),
			rootType: 'User',
			selection: {
				id: { keyRaw: 'id', type: 'ID' },
			},
		}
	})

	// @ts-ignore
	// run the source through the processor
	await subscriptionProcessor(config, doc)

	// invoke the test
	return doc
}
