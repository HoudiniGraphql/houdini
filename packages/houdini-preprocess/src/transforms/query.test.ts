// local imports
import '../../../../jest.setup'
import { preprocessorTest } from '../utils'

describe('query preprocessor', function () {
	test('route - preload initial data', async function () {
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
		`
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini";
		import { fetchQuery, RequestContext } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { houdiniConfig } from "$houdini";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery_Input = {};

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const [_TestQuery, _TestQuery_Source] = await fetchQuery({
		        "context": context,
		        "artifact": _TestQueryArtifact,
		        "variables": _TestQuery_Input,
		        "session": context.session
		    });

		    if (!_TestQuery.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    return {
		        props: {
		            _TestQuery: _TestQuery,
		            _TestQuery_Input: _TestQuery_Input,
		            _TestQuery_Source: _TestQuery_Source
		        }
		    };
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		export let _TestQuery = undefined;
		export let _TestQuery_Input = undefined;
		export let _TestQuery_Source = undefined;

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery,
		    "variables": _TestQuery_Input,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery_Source
		});

		const {
		    data
		} = routeQuery({
		    queryHandler: _TestQuery_handler,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
		    variableFunction: null,
		    getProps: () => $$props
		});

		$:
		{
		    _TestQuery_handler.onLoad(_TestQuery, _TestQuery_Input, _TestQuery_Source);
		}
	`)
	})

	test('preload initial data with variables', async function () {
		const doc = await preprocessorTest(
			`
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
		`
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini";
		import { fetchQuery, RequestContext } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { houdiniConfig } from "$houdini";

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);

		    const _TestQuery_Input = _houdini_context.computeInput({
		        "config": houdiniConfig,
		        "mode": "sapper",
		        "variableFunction": TestQueryVariables,
		        "artifact": _TestQueryArtifact
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const [_TestQuery, _TestQuery_Source] = await fetchQuery({
		        "context": context,
		        "artifact": _TestQueryArtifact,
		        "variables": _TestQuery_Input,
		        "session": context.session
		    });

		    if (!_TestQuery.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    return {
		        props: {
		            _TestQuery: _TestQuery,
		            _TestQuery_Input: _TestQuery_Input,
		            _TestQuery_Source: _TestQuery_Source
		        }
		    };
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		export let _TestQuery = undefined;
		export let _TestQuery_Input = undefined;
		export let _TestQuery_Source = undefined;

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery,
		    "variables": _TestQuery_Input,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery_Source
		});

		const {
		    data
		} = routeQuery({
		    queryHandler: _TestQuery_handler,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
		    variableFunction: TestQueryVariables,
		    getProps: () => $$props
		});

		$:
		{
		    _TestQuery_handler.onLoad(_TestQuery, _TestQuery_Input, _TestQuery_Source);
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
				route: true,
			}
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(`
		import { fetchQuery, RequestContext } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { houdiniConfig } from "$houdini";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery_Input = {};

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const [_TestQuery, _TestQuery_Source] = await fetchQuery({
		        "context": context,
		        "artifact": _TestQueryArtifact,
		        "variables": _TestQuery_Input,
		        "session": context.session
		    });

		    if (!_TestQuery.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    return {
		        props: {
		            _TestQuery: _TestQuery,
		            _TestQuery_Input: _TestQuery_Input,
		            _TestQuery_Source: _TestQuery_Source
		        }
		    };
		}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		export let _TestQuery = undefined;
		export let _TestQuery_Input = undefined;
		export let _TestQuery_Source = undefined;

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery,
		    "variables": _TestQuery_Input,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery_Source
		});

		const {
		    data
		} = routeQuery({
		    queryHandler: _TestQuery_handler,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
		    variableFunction: null,
		    getProps: () => $$props
		});

		$:
		{
		    _TestQuery_handler.onLoad(_TestQuery, _TestQuery_Input, _TestQuery_Source);
		}
	`)
	})

	test('svelte kit with static set', async function () {
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
				// if we are in a route but static is set to true, we need to treat the file like a
				// svelte component
				route: true,
				static: true,
			}
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(
			`import { houdiniConfig } from "$houdini";`
		)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		export let _TestQuery = undefined;
		export let _TestQuery_Input = undefined;
		export let _TestQuery_Source = undefined;

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery,
		    "variables": _TestQuery_Input,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery_Source
		});

		const {
		    data
		} = componentQuery({
		    queryHandler: _TestQuery_handler,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
		    variableFunction: null,
		    getProps: () => $$props
		});
	`)
	})

	test('non-route page - no variables', async function () {
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
				route: false,
			}
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(
			`import { houdiniConfig } from "$houdini";`
		)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		export let _TestQuery = undefined;
		export let _TestQuery_Input = undefined;
		export let _TestQuery_Source = undefined;

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery,
		    "variables": _TestQuery_Input,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery_Source
		});

		const {
		    data
		} = componentQuery({
		    queryHandler: _TestQuery_handler,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
		    variableFunction: null,
		    getProps: () => $$props
		});
	`)
	})

	test('non-route page - with variables', async function () {
		const doc = await preprocessorTest(
			`
			<script>
				const { data } = query(graphql\`
					query TestQuery($test: String!) {
						users(stringValue: $test) {
							id
						}
					}
				\`)
			</script>
		`,
			{
				mode: 'kit',
				route: false,
			}
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(
			`import { houdiniConfig } from "$houdini";`
		)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		export let _TestQuery = undefined;
		export let _TestQuery_Input = undefined;
		export let _TestQuery_Source = undefined;

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery,
		    "variables": _TestQuery_Input,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery_Source
		});

		const {
		    data
		} = componentQuery({
		    queryHandler: _TestQuery_handler,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
		    variableFunction: TestQueryVariables,
		    getProps: () => $$props
		});
	`)
	})

	test('paginated query gets reference to refetch artifact', async function () {
		const doc = await preprocessorTest(
			`
			<script context="module">
				export function TestQueryVariables(page) {
					return {
						test: true
					}
				}
			</script>

			<script>
				const { data } = paginatedQuery(graphql\`
					query TestQuery($test: Boolean!) {
						viewer @paginate {
							id
						}
					}
				\`)
			</script>
		`
		)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		export let _TestQuery = undefined;
		export let _TestQuery_Input = undefined;
		export let _TestQuery_Source = undefined;

		let _TestQuery_handler = paginatedQuery({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery,
		    "variables": _TestQuery_Input,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery_Source
		});

		const {
		    data
		} = routeQuery({
		    queryHandler: _TestQuery_handler,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
		    variableFunction: TestQueryVariables,
		    getProps: () => $$props
		});

		$:
		{
		    _TestQuery_handler.onLoad(_TestQuery, _TestQuery_Input, _TestQuery_Source);
		}
	`)
	})

	test('bare svelte component in route filepath', async function () {
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
				framework: 'svelte',
				route: true,
			}
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(
			`import { houdiniConfig } from "$houdini";`
		)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		export let _TestQuery = undefined;
		export let _TestQuery_Input = undefined;
		export let _TestQuery_Source = undefined;

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery,
		    "variables": _TestQuery_Input,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery_Source
		});

		const {
		    data
		} = componentQuery({
		    queryHandler: _TestQuery_handler,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
		    variableFunction: null,
		    getProps: () => $$props
		});
	`)
	})

	test.todo('fails if variable function is not present')

	test.todo('adds arguments to an empty preload')
})

test('onLoad hook', async function () {
	const doc = await preprocessorTest(
		`
		<script context="module">
			export async function onLoad(){
			   return this.redirect(302, "/test")
			}

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
	`
	)

	expect(doc.module?.content).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini";
		import { fetchQuery, RequestContext } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { houdiniConfig } from "$houdini";

		export async function onLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);

		    await _houdini_context.onLoadHook({
		        "mode": "sapper",
		        "onLoadFunction": onLoad
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery_Input = _houdini_context.computeInput({
		        "config": houdiniConfig,
		        "mode": "sapper",
		        "variableFunction": TestQueryVariables,
		        "artifact": _TestQueryArtifact
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const [_TestQuery, _TestQuery_Source] = await fetchQuery({
		        "context": context,
		        "artifact": _TestQueryArtifact,
		        "variables": _TestQuery_Input,
		        "session": context.session
		    });

		    if (!_TestQuery.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    return {
		        props: {
		            ..._houdini_context.returnValue,
		            _TestQuery: _TestQuery,
		            _TestQuery_Input: _TestQuery_Input,
		            _TestQuery_Source: _TestQuery_Source
		        }
		    };
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
})
