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
		import { convertKitPayload } from "$houdini/runtime";
		import { RequestContext } from "$houdini/runtime";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import _TestQueryStore from "$houdini/stores/TestQuery";
		import { houdiniConfig } from "$houdini";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery_Input = {};

		    const _TestQuery = await _TestQueryStore.fetch({
		        "variables": _TestQuery_Input,
		        "event": context
		    });

		    return _houdini_context.returnValue;
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		const {
		    data
		} = query({
		    kind: "HoudiniQuery",
		    store: _TestQueryStore,
		    component: false,
		    variableFunction: null,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact
		});
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
		import { RequestContext } from "$houdini/runtime";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import _TestQuery2Store from "$houdini/stores/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
		import _TestQuery1Store from "$houdini/stores/TestQuery1";
		import { houdiniConfig } from "$houdini";
		export async function load() {}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		const {
		    data: data1
		} = query({
		    kind: "HoudiniQuery",
		    store: _TestQuery1Store,
		    component: false,
		    variableFunction: null,
		    config: houdiniConfig,
		    artifact: _TestQuery1Artifact
		});

		const {
		    data: data2
		} = query({
		    kind: "HoudiniQuery",
		    store: _TestQuery2Store,
		    component: false,
		    variableFunction: null,
		    config: houdiniConfig,
		    artifact: _TestQuery2Artifact
		});
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
		import { convertKitPayload } from "$houdini/runtime";
		import { RequestContext } from "$houdini/runtime";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import _TestQuery2Store from "$houdini/stores/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
		import _TestQuery1Store from "$houdini/stores/TestQuery1";
		import { houdiniConfig } from "$houdini";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery2_Input = {};

		    const _TestQuery2Promise = _TestQuery2Store.fetch({
		        "variables": _TestQuery2_Input,
		        "event": context
		    });

		    const _TestQuery1_Input = {};

		    const _TestQuery1Promise = _TestQuery2Store.fetch({
		        "variables": _TestQuery1_Input,
		        "event": context
		    });

		    const _TestQuery2 = await _TestQuery2Promise;
		    const _TestQuery1 = await _TestQuery1Promise;
		    return _houdini_context.returnValue;
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		const {
		    data: data1
		} = query({
		    kind: "HoudiniQuery",
		    store: _TestQuery1Store,
		    component: false,
		    variableFunction: null,
		    config: houdiniConfig,
		    artifact: _TestQuery1Artifact
		});

		const {
		    data: data2
		} = query({
		    kind: "HoudiniQuery",
		    store: _TestQuery2Store,
		    component: false,
		    variableFunction: null,
		    config: houdiniConfig,
		    artifact: _TestQuery2Artifact
		});
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
		import { convertKitPayload } from "$houdini/runtime";
		import { RequestContext } from "$houdini/runtime";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import _TestQueryStore from "$houdini/stores/TestQuery";
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

		    const _TestQuery = await _TestQueryStore.fetch({
		        "variables": _TestQuery_Input,
		        "event": context
		    });

		    return _houdini_context.returnValue;
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		const {
		    data
		} = query({
		    kind: "HoudiniQuery",
		    store: _TestQueryStore,
		    component: false,
		    variableFunction: TestQueryVariables,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact
		});
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
		import { RequestContext } from "$houdini/runtime";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import _TestQueryStore from "$houdini/stores/TestQuery";
		import { houdiniConfig } from "$houdini";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery_Input = {};

		    const _TestQuery = await _TestQueryStore.fetch({
		        "variables": _TestQuery_Input,
		        "event": context
		    });

		    return _houdini_context.returnValue;
		}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		const {
		    data
		} = query({
		    kind: "HoudiniQuery",
		    store: _TestQueryStore,
		    component: false,
		    variableFunction: null,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact
		});
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
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import _TestQueryStore from "$houdini/stores/TestQuery";

		const {
		    data
		} = query({
		    kind: "HoudiniQuery",
		    store: _TestQueryStore,
		    component: true,
		    variableFunction: null,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
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
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import _TestQueryStore from "$houdini/stores/TestQuery";

		const {
		    data
		} = query({
		    kind: "HoudiniQuery",
		    store: _TestQueryStore,
		    component: true,
		    variableFunction: null,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
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
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import _TestQueryStore from "$houdini/stores/TestQuery";

		const {
		    data
		} = query({
		    kind: "HoudiniQuery",
		    store: _TestQueryStore,
		    component: true,
		    variableFunction: TestQueryVariables,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
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
		const {
		    data
		} = paginatedQuery({
		    kind: "HoudiniQuery",
		    store: _TestQueryStore,
		    component: false,
		    variableFunction: TestQueryVariables,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact
		});
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
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import _TestQueryStore from "$houdini/stores/TestQuery";

		const {
		    data
		} = query({
		    kind: "HoudiniQuery",
		    store: _TestQueryStore,
		    component: true,
		    variableFunction: null,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact,
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
		import { convertKitPayload } from "$houdini/runtime";
		import { RequestContext } from "$houdini/runtime";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import _TestQueryStore from "$houdini/stores/TestQuery";
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

		    const _TestQuery = await _TestQueryStore.fetch({
		        "variables": _TestQuery_Input,
		        "event": context
		    });

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
		import { convertKitPayload } from "$houdini/runtime";
		import { RequestContext } from "$houdini/runtime";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import _TestQuery2Store from "$houdini/stores/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
		import _TestQuery1Store from "$houdini/stores/TestQuery1";
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

		    const _TestQuery2Promise = _TestQuery2Store.fetch({
		        "variables": _TestQuery2_Input,
		        "event": context
		    });

		    const _TestQuery1_Input = {};

		    const _TestQuery1Promise = _TestQuery2Store.fetch({
		        "variables": _TestQuery1_Input,
		        "event": context
		    });

		    const _TestQuery2 = await _TestQuery2Promise;
		    const _TestQuery1 = await _TestQuery1Promise;
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
		import { convertKitPayload } from "$houdini/runtime";
		import { RequestContext } from "$houdini/runtime";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import _TestQueryStore from "$houdini/stores/TestQuery";
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

		    const _TestQuery = await _TestQueryStore.fetch({
		        "variables": _TestQuery_Input,
		        "event": context
		    });

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
		import { convertKitPayload } from "$houdini/runtime";
		import { RequestContext } from "$houdini/runtime";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import _TestQuery2Store from "$houdini/stores/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
		import _TestQuery1Store from "$houdini/stores/TestQuery1";
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

		    const _TestQuery2Promise = _TestQuery2Store.fetch({
		        "variables": _TestQuery2_Input,
		        "event": context
		    });

		    const _TestQuery1_Input = {};

		    const _TestQuery1Promise = _TestQuery2Store.fetch({
		        "variables": _TestQuery1_Input,
		        "event": context
		    });

		    const _TestQuery2 = await _TestQuery2Promise;
		    const _TestQuery1 = await _TestQuery1Promise;

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
		import { convertKitPayload } from "$houdini/runtime";
		import { RequestContext } from "$houdini/runtime";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import _TestQueryStore from "$houdini/stores/TestQuery";
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

		    const _TestQuery = await _TestQueryStore.fetch({
		        "variables": _TestQuery_Input,
		        "event": context
		    });

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
		import { convertKitPayload } from "$houdini/runtime";
		import { RequestContext } from "$houdini/runtime";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import _TestQueryStore from "$houdini/stores/TestQuery";
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

		    const _TestQuery = await _TestQueryStore.fetch({
		        "variables": _TestQuery_Input,
		        "event": context
		    });

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
	`,
		{
			route: false,
		}
	)

	expect(doc.instance?.content).toMatchInlineSnapshot(`
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import _TestQuery2Store from "$houdini/stores/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
		import _TestQuery1Store from "$houdini/stores/TestQuery1";

		const {
		    data
		} = query({
		    kind: "HoudiniQuery",
		    store: _TestQuery1Store,
		    component: true,
		    variableFunction: TestQuery1Variables,
		    config: houdiniConfig,
		    artifact: _TestQuery1Artifact,
		    getProps: () => $$props
		});

		const {
		    data: data2
		} = paginatedQuery({
		    kind: "HoudiniQuery",
		    store: _TestQuery2Store,
		    component: true,
		    variableFunction: TestQuery2Variables,
		    config: houdiniConfig,
		    artifact: _TestQuery2Artifact,
		    getProps: () => $$props
		});
	`)
})
