// local imports
import '../../../jest.setup'
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
		import _TestQueryStore from "$houdini/stores/GQL_TestQuery";
		import { houdiniConfig } from "$houdini";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery_Input = {};

		    const _TestQuery = await _TestQueryStore.load(context, {
		        "variables": _TestQuery_Input
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    return _houdini_context.returnValue;
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		export let _TestQuery = {};

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery.result,
		    "variables": _TestQuery.variables,
		    "partial": _TestQuery.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery.source
		});

		const {
		    data
		} = routeQuery({
		    queryHandler: _TestQuery_handler,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
		    variableFunction: null
		});

		$:
		{
		    _TestQuery_handler.onLoad(_TestQuery);
		}
	`)
	})

	test("existing loads aren't modified", async function () {
		const doc = await preprocessorTest(
			`
			<script context="module">
				export async function load() {
					
				}
			</script>
			<script>
				const { data: data1 } = query(graphql\`
					query TestQuery1 {
						viewer {
							id
						}
					}
				\`)
				const { data: data2 } = query(graphql\`
					query TestQuery2 {
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
		import _TestQuery2Store from "$houdini/stores/GQL_TestQuery2";
		import _TestQuery1Store from "$houdini/stores/GQL_TestQuery1";
		import { houdiniConfig } from "$houdini";
		export async function load() {}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		export let _TestQuery2 = {};

		let _TestQuery2_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery2.result,
		    "variables": _TestQuery2.variables,
		    "partial": _TestQuery2.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQuery2Artifact,
		    "source": _TestQuery2.source
		});

		export let _TestQuery1 = {};

		let _TestQuery1_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery1.result,
		    "variables": _TestQuery1.variables,
		    "partial": _TestQuery1.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQuery1Artifact,
		    "source": _TestQuery1.source
		});

		const {
		    data: data1
		} = routeQuery({
		    queryHandler: _TestQuery1_handler,
		    config: houdiniConfig,
		    artifact: _TestQuery1Artifact,
		    variableFunction: null
		});

		const {
		    data: data2
		} = routeQuery({
		    queryHandler: _TestQuery2_handler,
		    config: houdiniConfig,
		    artifact: _TestQuery2Artifact,
		    variableFunction: null
		});

		$:
		{
		    _TestQuery1_handler.onLoad(_TestQuery1);
		}

		$:
		{
		    _TestQuery2_handler.onLoad(_TestQuery2);
		}
	`)
	})

	test('route - preload initial data for multiple queries', async function () {
		const doc = await preprocessorTest(
			`
			<script>
				const { data: data1 } = query(graphql\`
					query TestQuery1 {
						viewer {
							id
						}
					}
				\`)
				const { data: data2 } = query(graphql\`
					query TestQuery2 {
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
		import _TestQuery2Store from "$houdini/stores/GQL_TestQuery2";
		import _TestQuery1Store from "$houdini/stores/GQL_TestQuery1";
		import { houdiniConfig } from "$houdini";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery2_Input = {};

		    const _TestQuery2Promise = _TestQuery2Store.load(context, {
		        "variables": _TestQuery2_Input
		    });

		    const _TestQuery1_Input = {};

		    const _TestQuery1Promise = _TestQuery1Store.load(context, {
		        "variables": _TestQuery1_Input
		    });

		    const _TestQuery2 = await _TestQuery2Promise;

		    if (!_TestQuery2.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery2);
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery1 = await _TestQuery1Promise;

		    if (!_TestQuery1.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery1);
		        return _houdini_context.returnValue;
		    }

		    return _houdini_context.returnValue;
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		export let _TestQuery2 = {};

		let _TestQuery2_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery2.result,
		    "variables": _TestQuery2.variables,
		    "partial": _TestQuery2.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQuery2Artifact,
		    "source": _TestQuery2.source
		});

		export let _TestQuery1 = {};

		let _TestQuery1_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery1.result,
		    "variables": _TestQuery1.variables,
		    "partial": _TestQuery1.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQuery1Artifact,
		    "source": _TestQuery1.source
		});

		const {
		    data: data1
		} = routeQuery({
		    queryHandler: _TestQuery1_handler,
		    config: houdiniConfig,
		    artifact: _TestQuery1Artifact,
		    variableFunction: null
		});

		const {
		    data: data2
		} = routeQuery({
		    queryHandler: _TestQuery2_handler,
		    config: houdiniConfig,
		    artifact: _TestQuery2Artifact,
		    variableFunction: null
		});

		$:
		{
		    _TestQuery1_handler.onLoad(_TestQuery1);
		}

		$:
		{
		    _TestQuery2_handler.onLoad(_TestQuery2);
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
		import _TestQueryStore from "$houdini/stores/GQL_TestQuery";
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
		        "framework": "sapper",
		        "variableFunction": TestQueryVariables,
		        "artifact": _TestQueryArtifact
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery = await _TestQueryStore.load(context, {
		        "variables": _TestQuery_Input
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    return _houdini_context.returnValue;
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		export let _TestQuery = {};

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery.result,
		    "variables": _TestQuery.variables,
		    "partial": _TestQuery.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery.source
		});

		const {
		    data
		} = routeQuery({
		    queryHandler: _TestQuery_handler,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
		    variableFunction: TestQueryVariables
		});

		$:
		{
		    _TestQuery_handler.onLoad(_TestQuery);
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
				module: 'esm',
				framework: 'kit',
				route: true,
			}
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(`
		import _TestQueryStore from "$houdini/stores/GQL_TestQuery";
		import { houdiniConfig } from "$houdini";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery_Input = {};

		    const _TestQuery = await _TestQueryStore.load(context, {
		        "variables": _TestQuery_Input
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    return _houdini_context.returnValue;
		}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		export let _TestQuery = {};

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery.result,
		    "variables": _TestQuery.variables,
		    "partial": _TestQuery.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery.source
		});

		const {
		    data
		} = routeQuery({
		    queryHandler: _TestQuery_handler,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
		    variableFunction: null
		});

		$:
		{
		    _TestQuery_handler.onLoad(_TestQuery);
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
				module: 'esm',
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
		import _TestQueryStore from "$houdini/stores/GQL_TestQuery";
		export let _TestQuery = {};

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery.result,
		    "variables": _TestQuery.variables,
		    "partial": _TestQuery.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery.source
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
				module: 'esm',
				route: false,
			}
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(
			`import { houdiniConfig } from "$houdini";`
		)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		import _TestQueryStore from "$houdini/stores/GQL_TestQuery";
		export let _TestQuery = {};

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery.result,
		    "variables": _TestQuery.variables,
		    "partial": _TestQuery.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery.source
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
				module: 'esm',
				route: false,
			}
		)

		// make sure we added the right stuff
		expect(doc.module?.content).toMatchInlineSnapshot(
			`import { houdiniConfig } from "$houdini";`
		)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		import _TestQueryStore from "$houdini/stores/GQL_TestQuery";
		export let _TestQuery = {};

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery.result,
		    "variables": _TestQuery.variables,
		    "partial": _TestQuery.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery.source
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
		export let _TestQuery = {};

		let _TestQuery_handler = paginatedQuery({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery.result,
		    "variables": _TestQuery.variables,
		    "partial": _TestQuery.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery.source
		});

		const {
		    data
		} = routeQuery({
		    queryHandler: _TestQuery_handler,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
		    variableFunction: TestQueryVariables
		});

		$:
		{
		    _TestQuery_handler.onLoad(_TestQuery);
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
		import _TestQueryStore from "$houdini/stores/GQL_TestQuery";
		export let _TestQuery = {};

		let _TestQuery_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery.result,
		    "variables": _TestQuery.variables,
		    "partial": _TestQuery.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQueryArtifact,
		    "source": _TestQuery.source
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

test('beforeLoad hook', async function () {
	const doc = await preprocessorTest(
		`
		<script context="module">
			export async function beforeLoad(){
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
		import _TestQueryStore from "$houdini/stores/GQL_TestQuery";
		import { houdiniConfig } from "$houdini";

		export async function beforeLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);

		    await _houdini_context.invokeLoadHook({
		        "variant": "before",
		        "framework": "sapper",
		        "hookFn": beforeLoad
		    });

		    const _TestQuery_Input = _houdini_context.computeInput({
		        "config": houdiniConfig,
		        "framework": "sapper",
		        "variableFunction": TestQueryVariables,
		        "artifact": _TestQueryArtifact
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery = await _TestQueryStore.load(context, {
		        "variables": _TestQuery_Input
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    return _houdini_context.returnValue;
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
})

test('beforeLoad hook - multiple queries', async function () {
	const doc = await preprocessorTest(
		`
		<script context="module">
			export async function beforeLoad(){
			   return this.redirect(302, "/test")
			}

			export function TestQueryVariables(page) {
				return {
					test: true
				}
			}
		</script>
		<script>
			const { data: data1 } = query(graphql\`
				query TestQuery1 {
					viewer {
						id
					}
				}
			\`)
			const { data: data2 } = query(graphql\`
				query TestQuery2 {
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
		import _TestQuery2Store from "$houdini/stores/GQL_TestQuery2";
		import _TestQuery1Store from "$houdini/stores/GQL_TestQuery1";
		import { houdiniConfig } from "$houdini";

		export async function beforeLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);

		    await _houdini_context.invokeLoadHook({
		        "variant": "before",
		        "framework": "sapper",
		        "hookFn": beforeLoad
		    });

		    const _TestQuery2_Input = {};

		    const _TestQuery2Promise = _TestQuery2Store.load(context, {
		        "variables": _TestQuery2_Input
		    });

		    const _TestQuery1_Input = {};

		    const _TestQuery1Promise = _TestQuery1Store.load(context, {
		        "variables": _TestQuery1_Input
		    });

		    const _TestQuery2 = await _TestQuery2Promise;

		    if (!_TestQuery2.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery2);
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery1 = await _TestQuery1Promise;

		    if (!_TestQuery1.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery1);
		        return _houdini_context.returnValue;
		    }

		    return _houdini_context.returnValue;
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
})

test('afterLoad hook', async function () {
	const doc = await preprocessorTest(
		`
		<script context="module">
			export async function afterLoad(){
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
		import _TestQueryStore from "$houdini/stores/GQL_TestQuery";
		import { houdiniConfig } from "$houdini";

		export async function afterLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);

		    const _TestQuery_Input = _houdini_context.computeInput({
		        "config": houdiniConfig,
		        "framework": "sapper",
		        "variableFunction": TestQueryVariables,
		        "artifact": _TestQueryArtifact
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery = await _TestQueryStore.load(context, {
		        "variables": _TestQuery_Input
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    await _houdini_context.invokeLoadHook({
		        "variant": "after",
		        "framework": "sapper",
		        "hookFn": afterLoad,

		        "input": {
		            "TestQuery": _TestQuery_Input
		        },

		        "data": {
		            "TestQuery": _TestQuery.result.data
		        }
		    });

		    return _houdini_context.returnValue;
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
})

test('afterLoad hook - multiple queries', async function () {
	const doc = await preprocessorTest(
		`
		<script context="module">
			export async function afterLoad(){
			   return this.redirect(302, "/test")
			}

			export function TestQueryVariables(page) {
				return {
					test: true
				}
			}
		</script>
		<script>
			const { data: data1 } = query(graphql\`
				query TestQuery1 {
					viewer {
						id
					}
				}
			\`)
			const { data: data2 } = query(graphql\`
				query TestQuery2 {
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
		import _TestQuery2Store from "$houdini/stores/GQL_TestQuery2";
		import _TestQuery1Store from "$houdini/stores/GQL_TestQuery1";
		import { houdiniConfig } from "$houdini";

		export async function afterLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery2_Input = {};

		    const _TestQuery2Promise = _TestQuery2Store.load(context, {
		        "variables": _TestQuery2_Input
		    });

		    const _TestQuery1_Input = {};

		    const _TestQuery1Promise = _TestQuery1Store.load(context, {
		        "variables": _TestQuery1_Input
		    });

		    const _TestQuery2 = await _TestQuery2Promise;

		    if (!_TestQuery2.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery2);
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery1 = await _TestQuery1Promise;

		    if (!_TestQuery1.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery1);
		        return _houdini_context.returnValue;
		    }

		    await _houdini_context.invokeLoadHook({
		        "variant": "after",
		        "framework": "sapper",
		        "hookFn": afterLoad,

		        "input": {
		            "TestQuery1": _TestQuery1_Input,
		            "TestQuery2": _TestQuery2_Input
		        },

		        "data": {
		            "TestQuery1": _TestQuery1.result.data,
		            "TestQuery2": _TestQuery2.result.data
		        }
		    });

		    return _houdini_context.returnValue;
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
})

test('both beforeLoad and afterLoad hooks', async function () {
	const doc = await preprocessorTest(
		`
		<script context="module">
		export async function beforeLoad(){
		   return this.redirect(302, "/test")
		}

			export async function afterLoad(){
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
		import _TestQueryStore from "$houdini/stores/GQL_TestQuery";
		import { houdiniConfig } from "$houdini";

		export async function beforeLoad() {
		    return this.redirect(302, "/test");
		}

		export async function afterLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);

		    await _houdini_context.invokeLoadHook({
		        "variant": "before",
		        "framework": "sapper",
		        "hookFn": beforeLoad
		    });

		    const _TestQuery_Input = _houdini_context.computeInput({
		        "config": houdiniConfig,
		        "framework": "sapper",
		        "variableFunction": TestQueryVariables,
		        "artifact": _TestQueryArtifact
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery = await _TestQueryStore.load(context, {
		        "variables": _TestQuery_Input
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    await _houdini_context.invokeLoadHook({
		        "variant": "after",
		        "framework": "sapper",
		        "hookFn": afterLoad,

		        "input": {
		            "TestQuery": _TestQuery_Input
		        },

		        "data": {
		            "TestQuery": _TestQuery.result.data
		        }
		    });

		    return _houdini_context.returnValue;
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
})

test('deprecated onLoad hook', async function () {
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
		import _TestQueryStore from "$houdini/stores/GQL_TestQuery";
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

		    await _houdini_context.invokeLoadHook({
		        "variant": "before",
		        "framework": "sapper",
		        "hookFn": onLoad
		    });

		    const _TestQuery_Input = _houdini_context.computeInput({
		        "config": houdiniConfig,
		        "framework": "sapper",
		        "variableFunction": TestQueryVariables,
		        "artifact": _TestQueryArtifact
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery = await _TestQueryStore.load(context, {
		        "variables": _TestQuery_Input
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    return _houdini_context.returnValue;
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
})

test('2 queries, one paginated one not', async function () {
	const doc = await preprocessorTest(
		`
		<script>
			const { data } = query(graphql\`
				query TestQuery1($test: Boolean!) {
					viewer {
						id
					}
				}
			\`)

			const { data: data2 } = paginatedQuery(graphql\`
				query TestQuery2($test: Boolean!) {
					viewer {
						id
					}
				}
			\`)
		</script>
	`
	)

	expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		export let _TestQuery2 = {};

		let _TestQuery2_handler = paginatedQuery({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery2.result,
		    "variables": _TestQuery2.variables,
		    "partial": _TestQuery2.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQuery2Artifact,
		    "source": _TestQuery2.source
		});

		export let _TestQuery1 = {};

		let _TestQuery1_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery1.result,
		    "variables": _TestQuery1.variables,
		    "partial": _TestQuery1.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQuery1Artifact,
		    "source": _TestQuery1.source
		});

		const {
		    data
		} = routeQuery({
		    queryHandler: _TestQuery1_handler,
		    config: houdiniConfig,
		    artifact: _TestQuery1Artifact,
		    variableFunction: TestQuery1Variables
		});

		const {
		    data: data2
		} = routeQuery({
		    queryHandler: _TestQuery2_handler,
		    config: houdiniConfig,
		    artifact: _TestQuery2Artifact,
		    variableFunction: TestQuery2Variables
		});

		$:
		{
		    _TestQuery1_handler.onLoad(_TestQuery1);
		}

		$:
		{
		    _TestQuery2_handler.onLoad(_TestQuery2);
		}
	`)
})
