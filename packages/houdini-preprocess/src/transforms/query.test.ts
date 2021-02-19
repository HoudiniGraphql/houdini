// external imports
import * as svelte from 'svelte/compiler'
import * as graphql from 'graphql'
// local imports
import queryProcessor from './query'
import { hashDocument, testConfig } from 'houdini-common'
import importArtifact from '../utils/importArtifact'
import '../../../../jest.setup'
import { GraphQLTagResult } from '../types'
import { preloadPayloadKey } from '../../build/transforms/query'
import { DocumentArtifact } from 'houdini-compiler'
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

		export async function preload(page, session) {
		    const _TestQuery = await fetchQuery({
		              "text": "\\n\\t\\t\\t\\t\\tquery TestQuery {\\n\\t\\t\\t\\t\\t\\tviewer {\\n\\t\\t\\t\\t\\t\\t\\tid\\n\\t\\t\\t\\t\\t\\t}\\n\\t\\t\\t\\t\\t}\\n\\t\\t\\t\\t"
		          });

		    return {
		        _TestQuery: _TestQuery
		    };
		}
	`)
		expect(doc.instance.content).toMatchInlineSnapshot(`
		import { updateStoreData } from "houdini";
		export let _TestQuery;

		const data = query({
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "raw": "\\n\\t\\t\\t\\t\\tquery TestQuery {\\n\\t\\t\\t\\t\\t\\tviewer {\\n\\t\\t\\t\\t\\t\\t\\tid\\n\\t\\t\\t\\t\\t\\t}\\n\\t\\t\\t\\t\\t}\\n\\t\\t\\t\\t",
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

		$:
		{
		    updateStoreData("TestQuery", _TestQuery.data);
		}
	`)
	})

	test('preload initial data with variables', async function () {
		const doc = await preprocessorTest(`
			<script context="module">
				export function TestQueryVariables(page) {
					return { 
						test: true
					}
				}
			</script>

			<script>
				const data = query(graphql\`
					query TestQuery($test: Boolean!) {
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

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function preload(page, session) {
		    const _TestQuery = await fetchQuery({
		              "text": "\\n\\t\\t\\t\\t\\tquery TestQuery($test: Boolean!) {\\n\\t\\t\\t\\t\\t\\tviewer {\\n\\t\\t\\t\\t\\t\\t\\tid\\n\\t\\t\\t\\t\\t\\t}\\n\\t\\t\\t\\t\\t}\\n\\t\\t\\t\\t",
		              "variables": TestQueryVariables.call(this, page, session)
		          });

		    return {
		        _TestQuery: _TestQuery
		    };
		}
	`)
		expect(doc.instance.content).toMatchInlineSnapshot(`
		import { updateStoreData } from "houdini";
		export let _TestQuery;

		const data = query({
		    "name": "TestQuery",
		    "kind": "HoudiniQuery",
		    "raw": "\\n\\t\\t\\t\\t\\tquery TestQuery($test: Boolean!) {\\n\\t\\t\\t\\t\\t\\tviewer {\\n\\t\\t\\t\\t\\t\\t\\tid\\n\\t\\t\\t\\t\\t\\t}\\n\\t\\t\\t\\t\\t}\\n\\t\\t\\t\\t",
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

		$:
		{
		    updateStoreData("TestQuery", _TestQuery.data);
		}
	`)
	})

	test.todo('fails if variable function is not present')

	test.todo('adds argumens to an empty preload')

	test.todo('adds second argument to preload with only one argument')

	test.todo('fails if arguments in preload are not page and params')
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
			name: 'TestQuery',
			kind: 'HoudiniQuery',
			raw: query,
			hash: hashDocument(parsedQuery),
		}
	})

	// @ts-ignore
	// run the source through the processor
	await queryProcessor(config, doc)

	// invoke the test
	return doc
}
