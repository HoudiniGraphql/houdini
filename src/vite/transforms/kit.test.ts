// local imports
import '../../../jest.setup'
import preprocessorTest from '../pluginTests'

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
		expect(doc).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini/runtime/lib/network";
		import { RequestContext } from "$houdini/runtime/lib/network";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { TestQueryStore } from "$houdini/stores/TestQuery";
		const store_TestQueryStore = TestQueryStore();
		import { houdiniConfig } from "$houdini";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery_Input = {};

		    const _TestQuery = await store_TestQueryStore.fetch({
		        "variables": _TestQuery_Input,
		        "event": context,
		        "blocking": false
		    });

		    return {
		        ..._houdini_context.returnValue,

		        props: {
		            ..._houdini_context.returnValue.props,
		            _TestQuery_Input: _TestQuery_Input
		        }
		    };
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
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
		expect(doc).toMatchInlineSnapshot(`
		import { RequestContext } from "$houdini/runtime/lib/network";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import { TestQuery2Store } from "$houdini/stores/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
		import { TestQuery1Store } from "$houdini/stores/TestQuery1";
		import { houdiniConfig } from "$houdini";
		export async function load() {}
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
		expect(doc).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini/runtime/lib/network";
		import { RequestContext } from "$houdini/runtime/lib/network";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import { TestQuery2Store } from "$houdini/stores/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
		import { TestQuery1Store } from "$houdini/stores/TestQuery1";
		const store_TestQuery1Store = TestQuery1Store();
		const store_TestQuery2Store = TestQuery2Store();
		import { houdiniConfig } from "$houdini";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery2_Input = {};

		    const _TestQuery2Promise = store_TestQuery2Store.fetch({
		        "variables": _TestQuery2_Input,
		        "event": context,
		        "blocking": false
		    });

		    const _TestQuery1_Input = {};

		    const _TestQuery1Promise = store_TestQuery1Store.fetch({
		        "variables": _TestQuery1_Input,
		        "event": context,
		        "blocking": false
		    });

		    const _TestQuery2 = await _TestQuery2Promise;
		    const _TestQuery1 = await _TestQuery1Promise;

		    return {
		        ..._houdini_context.returnValue,

		        props: {
		            ..._houdini_context.returnValue.props,
		            _TestQuery1_Input: _TestQuery1_Input,
		            _TestQuery2_Input: _TestQuery2_Input
		        }
		    };
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
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
		expect(doc).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini/runtime/lib/network";
		import { RequestContext } from "$houdini/runtime/lib/network";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { TestQueryStore } from "$houdini/stores/TestQuery";
		import { houdiniConfig } from "$houdini";
		const store_TestQueryStore = TestQueryStore();

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

		    const _TestQuery = await store_TestQueryStore.fetch({
		        "variables": _TestQuery_Input,
		        "event": context,
		        "blocking": false
		    });

		    return {
		        ..._houdini_context.returnValue,

		        props: {
		            ..._houdini_context.returnValue.props,
		            _TestQuery_Input: _TestQuery_Input
		        }
		    };
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
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
		expect(doc).toMatchInlineSnapshot(`
		import { RequestContext } from "$houdini/runtime/lib/network";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { TestQueryStore } from "$houdini/stores/TestQuery";
		const store_TestQueryStore = TestQueryStore();
		import { houdiniConfig } from "$houdini";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery_Input = {};

		    const _TestQuery = await store_TestQueryStore.fetch({
		        "variables": _TestQuery_Input,
		        "event": context,
		        "blocking": false
		    });

		    return {
		        ..._houdini_context.returnValue,

		        props: {
		            ..._houdini_context.returnValue.props,
		            _TestQuery_Input: _TestQuery_Input
		        }
		    };
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
		expect(doc).toMatchInlineSnapshot(`import { houdiniConfig } from "$houdini";`)
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
		expect(doc).toMatchInlineSnapshot(`
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { TestQueryStore } from "$houdini/stores/TestQuery";
		const store_TestQueryStore = TestQueryStore();
		const _houdini_context_generated_DONT_USE = getHoudiniContext();

		const {
		    data
		} = query({
		    kind: "HoudiniQuery",
		    store: store_TestQueryStore,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact
		});

		let _TestQuery_Input = {};

		$:
		isBrowser && store_TestQueryStore.fetch({
		    "variables": _TestQuery_Input,
		    "context": _houdini_context_generated_DONT_USE
		});
	`)
	})

	test('non-route page - with variables', async function () {
		const doc = await preprocessorTest(
			`
			<script context="module">
				export function TestQueryVariables() {
					return {
						hello: 'world'
					}
				}
			</script>

			<script>
				export let prop1 = 'hello'
				export const prop2 = 'goodbye'
				export let prop3, prop4

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
		expect(doc).toMatchInlineSnapshot(`
		import { houdiniConfig } from "$houdini";

		export function TestQueryVariables() {
		    return {
		        hello: "world"
		    };
		}
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

		expect(doc).toMatchInlineSnapshot()
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
		expect(doc).toMatchInlineSnapshot(`
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { TestQueryStore } from "$houdini/stores/TestQuery";
		const store_TestQueryStore = TestQueryStore();
		const _houdini_context_generated_DONT_USE = getHoudiniContext();

		const {
		    data
		} = query({
		    kind: "HoudiniQuery",
		    store: store_TestQueryStore,
		    config: houdiniConfig,
		    artifact: _TestQueryArtifact
		});

		let _TestQuery_Input = {};

		$:
		isBrowser && store_TestQueryStore.fetch({
		    "variables": _TestQuery_Input,
		    "context": _houdini_context_generated_DONT_USE
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

	expect(doc).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini/runtime/lib/network";
		import { RequestContext } from "$houdini/runtime/lib/network";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { TestQueryStore } from "$houdini/stores/TestQuery";
		import { houdiniConfig } from "$houdini";
		const store_TestQueryStore = TestQueryStore();

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

		    const _TestQuery = await store_TestQueryStore.fetch({
		        "variables": _TestQuery_Input,
		        "event": context,
		        "blocking": false
		    });

		    return {
		        ..._houdini_context.returnValue,

		        props: {
		            ..._houdini_context.returnValue.props,
		            _TestQuery_Input: _TestQuery_Input
		        }
		    };
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

	expect(doc).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini/runtime/lib/network";
		import { RequestContext } from "$houdini/runtime/lib/network";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import { TestQuery2Store } from "$houdini/stores/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
		import { TestQuery1Store } from "$houdini/stores/TestQuery1";
		import { houdiniConfig } from "$houdini";
		const store_TestQuery2Store = TestQuery2Store();
		const store_TestQuery1Store = TestQuery1Store();

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

		    const _TestQuery2Promise = store_TestQuery2Store.fetch({
		        "variables": _TestQuery2_Input,
		        "event": context,
		        "blocking": false
		    });

		    const _TestQuery1_Input = {};

		    const _TestQuery1Promise = store_TestQuery1Store.fetch({
		        "variables": _TestQuery1_Input,
		        "event": context,
		        "blocking": false
		    });

		    const _TestQuery2 = await _TestQuery2Promise;
		    const _TestQuery1 = await _TestQuery1Promise;

		    return {
		        ..._houdini_context.returnValue,

		        props: {
		            ..._houdini_context.returnValue.props,
		            _TestQuery1_Input: _TestQuery1_Input,
		            _TestQuery2_Input: _TestQuery2_Input
		        }
		    };
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

	expect(doc).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini/runtime/lib/network";
		import { RequestContext } from "$houdini/runtime/lib/network";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { TestQueryStore } from "$houdini/stores/TestQuery";
		import { houdiniConfig } from "$houdini";
		const store_TestQueryStore = TestQueryStore();

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

		    const _TestQuery = await store_TestQueryStore.fetch({
		        "variables": _TestQuery_Input,
		        "event": context,
		        "blocking": true
		    });

		    await _houdini_context.invokeLoadHook({
		        "variant": "after",
		        "framework": "sapper",
		        "hookFn": afterLoad,

		        "input": {
		            "TestQuery": _TestQuery_Input
		        },

		        "data": {
		            "TestQuery": _TestQuery.data
		        }
		    });

		    return {
		        ..._houdini_context.returnValue,

		        props: {
		            ..._houdini_context.returnValue.props,
		            _TestQuery_Input: _TestQuery_Input
		        }
		    };
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

	expect(doc).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini/runtime/lib/network";
		import { RequestContext } from "$houdini/runtime/lib/network";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import { TestQuery2Store } from "$houdini/stores/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
		import { TestQuery1Store } from "$houdini/stores/TestQuery1";
		import { houdiniConfig } from "$houdini";
		const store_TestQuery2Store = TestQuery2Store();
		const store_TestQuery1Store = TestQuery1Store();

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

		    const _TestQuery2Promise = store_TestQuery2Store.fetch({
		        "variables": _TestQuery2_Input,
		        "event": context,
		        "blocking": true
		    });

		    const _TestQuery1_Input = {};

		    const _TestQuery1Promise = store_TestQuery1Store.fetch({
		        "variables": _TestQuery1_Input,
		        "event": context,
		        "blocking": true
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
		            "TestQuery1": _TestQuery1.data,
		            "TestQuery2": _TestQuery2.data
		        }
		    });

		    return {
		        ..._houdini_context.returnValue,

		        props: {
		            ..._houdini_context.returnValue.props,
		            _TestQuery1_Input: _TestQuery1_Input,
		            _TestQuery2_Input: _TestQuery2_Input
		        }
		    };
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

	expect(doc).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini/runtime/lib/network";
		import { RequestContext } from "$houdini/runtime/lib/network";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { TestQueryStore } from "$houdini/stores/TestQuery";
		import { houdiniConfig } from "$houdini";
		const store_TestQueryStore = TestQueryStore();

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

		    const _TestQuery = await store_TestQueryStore.fetch({
		        "variables": _TestQuery_Input,
		        "event": context,
		        "blocking": true
		    });

		    await _houdini_context.invokeLoadHook({
		        "variant": "after",
		        "framework": "sapper",
		        "hookFn": afterLoad,

		        "input": {
		            "TestQuery": _TestQuery_Input
		        },

		        "data": {
		            "TestQuery": _TestQuery.data
		        }
		    });

		    return {
		        ..._houdini_context.returnValue,

		        props: {
		            ..._houdini_context.returnValue.props,
		            _TestQuery_Input: _TestQuery_Input
		        }
		    };
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

	expect(doc).toMatchInlineSnapshot(`
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import { TestQuery2Store } from "$houdini/stores/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
		import { TestQuery1Store } from "$houdini/stores/TestQuery1";
		const store_TestQuery1Store = TestQuery1Store();
		const store_TestQuery2Store = TestQuery2Store();
		const _houdini_context_generated_DONT_USE = getHoudiniContext();

		const {
		    data
		} = query({
		    kind: "HoudiniQuery",
		    store: store_TestQuery1Store,
		    config: houdiniConfig,
		    artifact: _TestQuery1Artifact
		});

		let _TestQuery2_Input = {};

		$:
		isBrowser && store_TestQuery2Store.fetch({
		    "variables": _TestQuery2_Input,
		    "context": _houdini_context_generated_DONT_USE
		});

		let _TestQuery1_Input = {};

		$:
		isBrowser && store_TestQuery1Store.fetch({
		    "variables": _TestQuery1_Input,
		    "context": _houdini_context_generated_DONT_USE
		});

		const {
		    data: data2
		} = paginatedQuery({
		    kind: "HoudiniQuery",
		    store: store_TestQuery2Store,
		    config: houdiniConfig,
		    artifact: _TestQuery2Artifact
		});
	`)
})

test('Using type in a js script tag is wrong', async function () {
	try {
		await preprocessorTest(
			`
			<script>
			const { data } = query<TestQuery1>(graphql\`
			query TestQuery1($test: Boolean!) {
				viewer {
					id
				}
			}
			\`)
			</script>
			`
		)
	} catch (error: any) {
		expect(error.filepath).toContain('routes/component.svelte')
		expect(error.message).toMatchInlineSnapshot(
			`"query<MY_TYPE>(graphql... is not valid. 2 Options: 1/ add lang=\\"ts\\" in script tag, 2/ get rid of the <MY_TYPE>."`
		)
	}
})

test('Using type in a ts script tag is good', async function () {
	try {
		const doc = await preprocessorTest(
			`<script lang="ts">
				const { data } = query<TestQuery1>(graphql\`
				query TestQuery1($test: Boolean!) {
					viewer {
						id
					}
				}
				\`)
				</script>`
		)
	} catch (error) {
		// We should never get here
		expect(1).toBe(2)
	} finally {
		expect(1).toBe(1)
	}
})
