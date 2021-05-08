// external imports
import * as svelte from 'svelte/compiler'
import * as graphql from 'graphql'
// local imports
import queryProcessor from './query'
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

describe('query preprocessor', function () {
	test('preload initial data', async function () {
		const doc = await preprocessorTest(`
			<script>
				const { data } = query(graphql\`
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
		import { convertKitPayload } from "$houdini";
		import { fetchQuery, RequestContext } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery_Input = {};

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery = await fetchQuery(_houdini_context, {
		              "text": _TestQueryArtifact.raw,
		              "variables": _TestQuery_Input
		          }, context.session);

		    if (_TestQuery.errors) {
		        _houdini_context.graphqlErrors(_TestQuery.errors);
		        return _houdini_context.returnValue;
		    }

		    return {
		        props: {
		            _TestQuery: _TestQuery,
		            _TestQuery_Input: _TestQuery_Input
		        }
		    };
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
		expect(doc.instance.content).toMatchInlineSnapshot(`
		import { getQuery, query } from "$houdini";
		export let _TestQuery;
		export let _TestQuery_Input;

		let _TestQuery_handler = query({
		    "initialValue": _TestQuery,
		    "variables": _TestQuery_Input,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact
		});

		const {
		    data
		} = getQuery(_TestQuery_handler);

		$:
		{
		    _TestQuery_handler.writeData(_TestQuery, _TestQuery_Input);
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
				const { data } = query(graphql\`
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
		import { convertKitPayload } from "$houdini";
		import { fetchQuery, RequestContext } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery_Input = _houdini_context.computeInput("sapper", TestQueryVariables);

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery = await fetchQuery(_houdini_context, {
		              "text": _TestQueryArtifact.raw,
		              "variables": _TestQuery_Input
		          }, context.session);

		    if (_TestQuery.errors) {
		        _houdini_context.graphqlErrors(_TestQuery.errors);
		        return _houdini_context.returnValue;
		    }

		    return {
		        props: {
		            _TestQuery: _TestQuery,
		            _TestQuery_Input: _TestQuery_Input
		        }
		    };
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
		expect(doc.instance.content).toMatchInlineSnapshot(`
		import { getQuery, query } from "$houdini";
		export let _TestQuery;
		export let _TestQuery_Input;

		let _TestQuery_handler = query({
		    "initialValue": _TestQuery,
		    "variables": _TestQuery_Input,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact
		});

		const {
		    data
		} = getQuery(_TestQuery_handler);

		$:
		{
		    _TestQuery_handler.writeData(_TestQuery, _TestQuery_Input);
		}
	`)
	})

	test('sveltekit', async function () {
		const doc = await preprocessorTest(
			`
			<script>
				const { data } = query(graphql\`
					query TestQuery {
						viewer {
							id
						}
					}
				\`)
			</script>
		`,
			{
				mode: 'kit',
			}
		)

		// make sure we added the right stuff
		expect(doc.module.content).toMatchInlineSnapshot(`
		import { fetchQuery, RequestContext } from "$houdini";
		import * as _TestQueryArtifact from "$houdini/artifacts/TestQuery";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery_Input = {};

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery = await fetchQuery(_houdini_context, {
		              "text": _TestQueryArtifact.raw,
		              "variables": _TestQuery_Input
		          }, context.session);

		    if (_TestQuery.errors) {
		        _houdini_context.graphqlErrors(_TestQuery.errors);
		        return _houdini_context.returnValue;
		    }

		    return {
		        props: {
		            _TestQuery: _TestQuery,
		            _TestQuery_Input: _TestQuery_Input
		        }
		    };
		}
	`)
		expect(doc.instance.content).toMatchInlineSnapshot(`
		import { getQuery, query } from "$houdini";
		export let _TestQuery;
		export let _TestQuery_Input;

		let _TestQuery_handler = query({
		    "initialValue": _TestQuery,
		    "variables": _TestQuery_Input,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact
		});

		const {
		    data
		} = getQuery(_TestQuery_handler);

		$:
		{
		    _TestQuery_handler.writeData(_TestQuery, _TestQuery_Input);
		}
	`)
	})

	test.todo('fails if variable function is not present')

	test.todo('adds arguments to an empty preload')

	test.todo('adds second argument to preload with only one argument')

	test.todo('fails if arguments in preload are not page and params')
})

async function preprocessorTest(content: string, cfg?: {}) {
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
	const config = testConfig({ schema, verifyHash: false, ...cfg })

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
			rootType: 'Query',
			selection: {
				viewer: {
					keyRaw: 'viewer',
					type: 'User',
					fields: {
						id: {
							keyRaw: 'id',
							type: 'ID',
						},
					},
				},
			},
		}
	})

	// @ts-ignore
	// run the source through the processor
	await queryProcessor(config, doc)

	// invoke the test
	return doc
}
