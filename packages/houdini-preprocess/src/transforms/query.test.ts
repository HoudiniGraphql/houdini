// external imports
import * as svelte from 'svelte/compiler'
// local imports
import queryProcessor from './query'
import { testConfig } from 'houdini-common'
import importArtifact from '../utils/importArtifact'
import '../../../../jest.setup'
import { GraphQLTagResult } from '../types'
// mock out the walker so that imports don't actually happen
jest.mock('../utils/importArtifact')

beforeEach(() => {
	// @ts-ignore
	// Clear all instances and calls to constructor and all methods:
	importArtifact.mockClear()
})

describe('query preprocessor', function () {
	test('preload initial data', async function () {
		const doc = await preprocessorTest(`
			<script>
				const data = query(graphql\`
					query TestQuery {
						viewer {
							id
						}
					}
				\`)
			</script>
		`)

		// make sure we added the right stuff
		expect(doc.module.content).toMatchInlineSnapshot(`
		import { fetchQuery } from "houdini";

		export async function preload() {
		    const _TestQuery = await fetchQuery({
		              "text": "__query__string__"
		          });

		    return {
		        _TestQuery: _TestQuery
		    };
		}
	`)
		expect(doc.instance.content).toMatchInlineSnapshot(`
		export let _TestQuery;

		const data = query({
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "raw": "__query__string__",
		    "initialValue": _TestQuery,

		    "processResult": data => {
		        return {
		            "__ref": data,

		            "viewer": {
		                "__ref": data.viewer,
		                "id": data.viewer.id
		            }
		        };
		    }
		});
	`)
	})
})

async function preprocessorTest(content: string) {
	const schema = `
		type User {
			id: ID!
		}

		type Query {
			viewer: User!
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
	// mock the import statement
	importArtifact.mockImplementation(function (): GraphQLTagResult {
		return {
			name: 'TestQuery',
			kind: 'HoudiniQuery',
			raw: '__query__string__',
			processResult: (result: any) => {},
			initialValue: '_TestQuery',
		}
	})

	// @ts-ignore
	// run the source through the processor
	await queryProcessor(config, doc)

	// invoke the test
	return doc
}
