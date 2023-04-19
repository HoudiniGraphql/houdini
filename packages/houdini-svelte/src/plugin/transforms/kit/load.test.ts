import { test, expect, describe } from 'vitest'

import { route_test } from '../../../test'

describe('kit route processor', function () {
	test('inline function', async function () {
		const route = await route_test({
			component: `
				<script>
					$: store = graphql(\`
						query TestQuery @load {
							viewer {
								oid
							}
						}
					\`)


				</script>
			`,
		})
		expect(route.script).toMatchInlineSnapshot(`
			import { load_TestQuery } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
			import _TestQueryArtifact from "$houdini/artifacts/TestQuery";

			export async function load(context) {
			    const houdini_context = new RequestContext(context);
			    const houdiniConfig = getCurrentConfig();
			    const promises = [];
			    const inputs = {};
			    inputs["TestQuery"] = {};

			    promises.push(load_TestQuery({
			        "variables": inputs["TestQuery"],
			        "event": context,
			        "blocking": undefined
			    }));

			    let result = {};

			    try {
			        result = Object.assign({}, ...(await Promise.all(promises)));
			    } catch (err) {
			        throw err;
			    }

			    return {
			        ...houdini_context.returnValue,
			        ...result
			    };
			}
		`)
		expect(route.component).toMatchInlineSnapshot(`
			export let data;

			$:
			store = data.TestQuery;
		`)
	})

	test('inline template', async function () {
		const route = await route_test({
			component: `
				<script>
					$: result = graphql\`
						query TestQuery @load {
							viewer {
								id
							}
						}
					\`
				</script>
			`,
		})

		// make sure we added the right stuff
		expect(route.component).toMatchInlineSnapshot(`
			export let data;

			$:
			result = data.TestQuery;
		`)
		expect(route.script).toMatchInlineSnapshot(`
			import { load_TestQuery } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
			import _TestQueryArtifact from "$houdini/artifacts/TestQuery";

			export async function load(context) {
			    const houdini_context = new RequestContext(context);
			    const houdiniConfig = getCurrentConfig();
			    const promises = [];
			    const inputs = {};
			    inputs["TestQuery"] = {};

			    promises.push(load_TestQuery({
			        "variables": inputs["TestQuery"],
			        "event": context,
			        "blocking": undefined
			    }));

			    let result = {};

			    try {
			        result = Object.assign({}, ...(await Promise.all(promises)));
			    } catch (err) {
			        throw err;
			    }

			    return {
			        ...houdini_context.returnValue,
			        ...result
			    };
			}
		`)
	})

	test('inline query, no ssr', async function () {
		const route = await route_test({
			component: `
				<script>
					$: result = graphql\`
						query TestQuery {
							viewer {
								id
							}
						}
					\`
				</script>
			`,
		})

		// make sure we added the right stuff
		expect(route.component).toMatchInlineSnapshot(`
			import { TestQueryStore } from "$houdini/plugins/houdini-svelte/stores/TestQuery";

			$:
			result = new TestQueryStore();
		`)
		expect(route.script).toMatchInlineSnapshot('')
	})

	test("existing loads aren't modified", async function () {
		const route = await route_test({
			script: `
					export async function load() {

					}
				`,
			component: `
					<script>
						$: result = graphql\`
							query TestQuery1 @load {
								viewer {
									id
								}
							}
						\`
					</script>
				`,
		})

		// make sure we added the right stuff
		expect(route.script).toMatchInlineSnapshot(`
			import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
			export async function load() {}
		`)
	})

	test('multiple inline queries', async function () {
		const route = await route_test({
			component: `
				<script>
					$: data1 = graphql\`
						query TestQuery1 @load {
							viewer {
								id
							}
						}
					\`
					$: data2 = graphql\`
						query TestQuery2 @load {
							viewer {
								id
							}
						}
					\`
				</script>
			`,
		})

		// make sure we added the right stuff
		expect(route.component).toMatchInlineSnapshot(`
			export let data;

			$:
			data1 = data.TestQuery1;

			$:
			data2 = data.TestQuery2;
		`)
		expect(route.script).toMatchInlineSnapshot(`
			import { load_TestQuery2 } from "$houdini/plugins/houdini-svelte/stores/TestQuery2";
			import { load_TestQuery1 } from "$houdini/plugins/houdini-svelte/stores/TestQuery1";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
			import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
			import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";

			export async function load(context) {
			    const houdini_context = new RequestContext(context);
			    const houdiniConfig = getCurrentConfig();
			    const promises = [];
			    const inputs = {};
			    inputs["TestQuery1"] = {};

			    promises.push(load_TestQuery1({
			        "variables": inputs["TestQuery1"],
			        "event": context,
			        "blocking": undefined
			    }));

			    inputs["TestQuery2"] = {};

			    promises.push(load_TestQuery2({
			        "variables": inputs["TestQuery2"],
			        "event": context,
			        "blocking": undefined
			    }));

			    let result = {};

			    try {
			        result = Object.assign({}, ...(await Promise.all(promises)));
			    } catch (err) {
			        throw err;
			    }

			    return {
			        ...houdini_context.returnValue,
			        ...result
			    };
			}
		`)
	})

	test('compute variables', async function () {
		const route = await route_test({
			script: `
					export async function _TestQueryVariables(page) {
						return {
							test: true
						}
					}
				`,
			component: `
					<script>
						$: data1 = graphql\`
							query TestQuery($test: Boolean!) @load {
								viewer {
									id
								}
							}
						\`
					</script>
				`,
		})

		// make sure we added the right stuff
		expect(route.script).toMatchInlineSnapshot(`
			import { load_TestQuery } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
			import { parseScalar, marshalInputs } from "$houdini/runtime/lib/scalars";
			import _TestQueryArtifact from "$houdini/artifacts/TestQuery";

			export async function _TestQueryVariables(page) {
			    return {
			        test: true
			    };
			}

			async function __houdini___TestQueryVariables(config, event) {
			    const result = {};

			    Object.assign(result, marshalInputs({
			        config: config,
			        input: await _TestQueryVariables(event),
			        artifact: _TestQueryArtifact
			    }));

			    return result;
			}

			export async function load(context) {
			    const houdini_context = new RequestContext(context);
			    const houdiniConfig = getCurrentConfig();
			    const promises = [];
			    const inputs = {};
			    inputs["TestQuery"] = await __houdini___TestQueryVariables(houdiniConfig, context);

			    promises.push(load_TestQuery({
			        "variables": inputs["TestQuery"],
			        "event": context,
			        "blocking": undefined
			    }));

			    let result = {};

			    try {
			        result = Object.assign({}, ...(await Promise.all(promises)));
			    } catch (err) {
			        throw err;
			    }

			    return {
			        ...houdini_context.returnValue,
			        ...result
			    };
			}
		`)
	})

	test('bare svelte component in route filepath', async function () {
		const route = await route_test({
			component: `
					<script>
						$: test = graphql\`
							query TestQuery @load {
								viewer {
									id
								}
							}
						\`
					</script>
				`,
			framework: 'svelte',
		})

		// make sure we added the right stuff
		expect(route.component).toMatchInlineSnapshot(`
			import { TestQueryStore } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
			import { isBrowser } from "$houdini/plugins/houdini-svelte/runtime/adapter";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { marshalInputs } from "$houdini/runtime/lib/scalars";
			const _houdini_TestQuery = new TestQueryStore();

			$:
			test = _houdini_TestQuery;

			$:
			isBrowser && _houdini_TestQuery.fetch({
			    variables: marshalInputs({
			        config: getCurrentConfig(),
			        artifact: _houdini_TestQuery.artifact,
			        input: {}
			    })
			});
		`)
	})

	test('route with page stores and inline queries', async function () {
		const MyQuery1 = `
			query MyQuery1 {
				field
			}
		`

		const MyQuery2 = `
			query MyQuery2($input: Int) @load {
				field(input: $input)
			}
		`

		const route = await route_test({
			component: `
				<script>
					$: result = graphql\`
						query TestQuery @load {
							viewer {
								id
							}
						}
					\`
				</script>
			`,
			script: `
				const store1 = graphql\`
					${MyQuery1}
				\`

				const store2 = graphql\`
					${MyQuery2}
				\`

				export function _MyQuery2Variables() {

				}

				export const _houdini_load = [store1, store2]
			`,
		})

		expect(route.component).toMatchInlineSnapshot(`
			export let data;

			$:
			result = data.TestQuery;
		`)
		expect(route.script).toMatchInlineSnapshot(`
			import { MyQuery2Store } from "$houdini/plugins/houdini-svelte/stores/MyQuery2";
			import { MyQuery1Store } from "$houdini/plugins/houdini-svelte/stores/MyQuery1";
			import { load_TestQuery } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
			import { load_MyQuery2 } from "$houdini/plugins/houdini-svelte/stores/MyQuery2";
			import { load_MyQuery1 } from "$houdini/plugins/houdini-svelte/stores/MyQuery1";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
			import _MyQuery2Artifact from "$houdini/artifacts/MyQuery2";
			import { parseScalar, marshalInputs } from "$houdini/runtime/lib/scalars";
			import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
			const store1 = new MyQuery1Store();
			const store2 = new MyQuery2Store();
			export function _MyQuery2Variables() {}
			export const _houdini_load = [store1, store2];

			async function __houdini___MyQuery2Variables(config, event) {
			    const result = {};

			    Object.assign(result, marshalInputs({
			        config: config,
			        input: await _MyQuery2Variables(event),
			        artifact: _MyQuery2Artifact
			    }));

			    return result;
			}

			export async function load(context) {
			    const houdini_context = new RequestContext(context);
			    const houdiniConfig = getCurrentConfig();
			    const promises = [];
			    const inputs = {};
			    inputs["MyQuery1"] = {};

			    promises.push(load_MyQuery1({
			        "variables": inputs["MyQuery1"],
			        "event": context,
			        "blocking": undefined
			    }));

			    inputs["MyQuery2"] = await __houdini___MyQuery2Variables(houdiniConfig, context);

			    promises.push(load_MyQuery2({
			        "variables": inputs["MyQuery2"],
			        "event": context,
			        "blocking": undefined
			    }));

			    inputs["TestQuery"] = {};

			    promises.push(load_TestQuery({
			        "variables": inputs["TestQuery"],
			        "event": context,
			        "blocking": undefined
			    }));

			    let result = {};

			    try {
			        result = Object.assign({}, ...(await Promise.all(promises)));
			    } catch (err) {
			        throw err;
			    }

			    return {
			        ...houdini_context.returnValue,
			        ...result
			    };
			}
		`)
	})

	test('route with +page.gql query', async function () {
		const route = await route_test({
			page_query: `
				query TestPageQuery {
					viewer {
						id
					}
				}
			`,
		})

		expect(route.component).toMatchInlineSnapshot('')

		expect(route.script).toMatchInlineSnapshot(`
			import { load_TestPageQuery } from "$houdini/plugins/houdini-svelte/stores/TestPageQuery";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";

			export async function load(context) {
			    const houdini_context = new RequestContext(context);
			    const houdiniConfig = getCurrentConfig();
			    const promises = [];
			    const inputs = {};
			    inputs["TestPageQuery"] = {};

			    promises.push(load_TestPageQuery({
			        "variables": inputs["TestPageQuery"],
			        "event": context,
			        "blocking": undefined
			    }));

			    let result = {};

			    try {
			        result = Object.assign({}, ...(await Promise.all(promises)));
			    } catch (err) {
			        throw err;
			    }

			    return {
			        ...houdini_context.returnValue,
			        ...result
			    };
			}
		`)

		expect(route.layout).toMatchInlineSnapshot(`
			import { page } from "$app/stores";
			import { extractSession, setClientSession } from "$houdini/plugins/houdini-svelte/runtime/session";
			import { onMount } from "svelte";
			import { setClientStarted } from "$houdini/plugins/houdini-svelte/runtime/adapter";
			onMount(() => setClientStarted());

			page.subscribe(val => {
			    setClientSession(extractSession(val.data));
			});
		`)

		expect(route.layout_script).toMatchInlineSnapshot(`
			export async function load(event) {
			    const __houdini__vite__plugin__return__value__ = {};

			    return {
			        ...event.data,
			        ...__houdini__vite__plugin__return__value__
			    };
			}
		`)
	})

	test('route with +layout.gql query', async function () {
		const route = await route_test({
			layout_query: `
				query TestLayoutQuery {
					viewer {
						id
					}
				}
			`,
		})

		expect(route.component).toMatchInlineSnapshot('')

		expect(route.script).toMatchInlineSnapshot('')

		expect(route.layout).toMatchInlineSnapshot(`
			import { page } from "$app/stores";
			import { extractSession, setClientSession } from "$houdini/plugins/houdini-svelte/runtime/session";
			import { onMount } from "svelte";
			import { setClientStarted } from "$houdini/plugins/houdini-svelte/runtime/adapter";
			onMount(() => setClientStarted());

			page.subscribe(val => {
			    setClientSession(extractSession(val.data));
			});
		`)

		expect(route.layout_script).toMatchInlineSnapshot(`
			import { load_TestLayoutQuery } from "$houdini/plugins/houdini-svelte/stores/TestLayoutQuery";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";

			export async function load(context) {
			    const houdini_context = new RequestContext(context);
			    const houdiniConfig = getCurrentConfig();
			    const promises = [];
			    const inputs = {};
			    inputs["TestLayoutQuery"] = {};

			    promises.push(load_TestLayoutQuery({
			        "variables": inputs["TestLayoutQuery"],
			        "event": context,
			        "blocking": undefined
			    }));

			    let result = {};

			    try {
			        result = Object.assign({}, ...(await Promise.all(promises)));
			    } catch (err) {
			        throw err;
			    }

			    const __houdini__vite__plugin__return__value__ = {
			        ...houdini_context.returnValue,
			        ...result
			    };

			    return {
			        ...context.data,
			        ...__houdini__vite__plugin__return__value__
			    };
			}
		`)
	})

	test.todo('fails if variable function is not present')
})

test('beforeLoad hook', async function () {
	const route = await route_test({
		script: `
			export async function _houdini_beforeLoad(){
				return this.redirect(302, "/test")
			}

			export function _TestQueryVariables(page) {
				return {
					test: true
				}
			}
		`,
		component: `
				<script>
					$: result = graphql\`
						query TestQuery($test: Boolean!) @load {
							viewer {
								id
							}
						}
					\`
				</script>
			`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { load_TestQuery } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { parseScalar, marshalInputs } from "$houdini/runtime/lib/scalars";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";

		export async function _houdini_beforeLoad() {
		    return this.redirect(302, "/test");
		}

		export function _TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		async function __houdini___TestQueryVariables(config, event) {
		    const result = {};

		    Object.assign(result, marshalInputs({
		        config: config,
		        input: await _TestQueryVariables(event),
		        artifact: _TestQueryArtifact
		    }));

		    return result;
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);

		    await houdini_context.invokeLoadHook({
		        "variant": "before",
		        "hookFn": _houdini_beforeLoad
		    });

		    const houdiniConfig = getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["TestQuery"] = await __houdini___TestQueryVariables(houdiniConfig, context);

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": undefined
		    }));

		    let result = {};

		    try {
		        result = Object.assign({}, ...(await Promise.all(promises)));
		    } catch (err) {
		        throw err;
		    }

		    return {
		        ...houdini_context.returnValue,
		        ...result
		    };
		}
	`)
})

test('beforeLoad hook - multiple queries', async function () {
	const route = await route_test({
		script: `
			export async function _houdini_beforeLoad(){
				return this.redirect(302, "/test")
			}

			export function _TestQueryVariables(page) {
				return {
					test: true
				}
			}
		`,
		component: `
				<script>
					$: ({ data: data1 } = graphql\`
						query TestQuery1 @load {
							viewer {
								id
							}
						}
					\`)
					$: ({ data: data2 } = graphql\`
						query TestQuery2 @load {
							viewer {
								id
							}
						}
					\`)
				</script>
			`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { load_TestQuery2 } from "$houdini/plugins/houdini-svelte/stores/TestQuery2";
		import { load_TestQuery1 } from "$houdini/plugins/houdini-svelte/stores/TestQuery1";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";

		export async function _houdini_beforeLoad() {
		    return this.redirect(302, "/test");
		}

		export function _TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);

		    await houdini_context.invokeLoadHook({
		        "variant": "before",
		        "hookFn": _houdini_beforeLoad
		    });

		    const houdiniConfig = getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["TestQuery1"] = {};

		    promises.push(load_TestQuery1({
		        "variables": inputs["TestQuery1"],
		        "event": context,
		        "blocking": undefined
		    }));

		    inputs["TestQuery2"] = {};

		    promises.push(load_TestQuery2({
		        "variables": inputs["TestQuery2"],
		        "event": context,
		        "blocking": undefined
		    }));

		    let result = {};

		    try {
		        result = Object.assign({}, ...(await Promise.all(promises)));
		    } catch (err) {
		        throw err;
		    }

		    return {
		        ...houdini_context.returnValue,
		        ...result
		    };
		}
	`)
})

test('afterLoad hook', async function () {
	const route = await route_test({
		script: `
				export async function _houdini_afterLoad(){
				   return this.redirect(302, "/test")
				}

				export function _TestQueryVariables(page) {
					return {
						test: true
					}
				}
		`,
		component: `
				<script>
					$: result = graphql\`
						query TestQuery($test: Boolean!) @load {
							viewer {
								id
							}
						}
					\`
				</script>
			`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { load_TestQuery } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { parseScalar, marshalInputs } from "$houdini/runtime/lib/scalars";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";

		export async function _houdini_afterLoad() {
		    return this.redirect(302, "/test");
		}

		export function _TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		async function __houdini___TestQueryVariables(config, event) {
		    const result = {};

		    Object.assign(result, marshalInputs({
		        config: config,
		        input: await _TestQueryVariables(event),
		        artifact: _TestQueryArtifact
		    }));

		    return result;
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const houdiniConfig = getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["TestQuery"] = await __houdini___TestQueryVariables(houdiniConfig, context);

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": true
		    }));

		    let result = {};

		    try {
		        result = Object.assign({}, ...(await Promise.all(promises)));
		    } catch (err) {
		        throw err;
		    }

		    await houdini_context.invokeLoadHook({
		        "variant": "after",
		        "hookFn": _houdini_afterLoad,
		        "input": inputs,
		        "data": result
		    });

		    return {
		        ...houdini_context.returnValue,
		        ...result
		    };
		}
	`)
})

test('afterLoad hook - multiple queries', async function () {
	const route = await route_test({
		script: `
			export async function _houdini_afterLoad(){
			   return this.redirect(302, "/test")
			}

			export function _TestQueryVariables(page) {
				return {
					test: true
				}
			}
		`,
		component: `
			<script>
				$:( { data: data1 } = graphql\`
					query TestQuery1 @load {
						viewer {
							id
						}
					}
				\`)
				$:( { data: data2 } = graphql\`
					query TestQuery2 @load {
						viewer {
							id
						}
					}
				\`)
			</script>
		`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { load_TestQuery2 } from "$houdini/plugins/houdini-svelte/stores/TestQuery2";
		import { load_TestQuery1 } from "$houdini/plugins/houdini-svelte/stores/TestQuery1";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";

		export async function _houdini_afterLoad() {
		    return this.redirect(302, "/test");
		}

		export function _TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const houdiniConfig = getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["TestQuery1"] = {};

		    promises.push(load_TestQuery1({
		        "variables": inputs["TestQuery1"],
		        "event": context,
		        "blocking": true
		    }));

		    inputs["TestQuery2"] = {};

		    promises.push(load_TestQuery2({
		        "variables": inputs["TestQuery2"],
		        "event": context,
		        "blocking": true
		    }));

		    let result = {};

		    try {
		        result = Object.assign({}, ...(await Promise.all(promises)));
		    } catch (err) {
		        throw err;
		    }

		    await houdini_context.invokeLoadHook({
		        "variant": "after",
		        "hookFn": _houdini_afterLoad,
		        "input": inputs,
		        "data": result
		    });

		    return {
		        ...houdini_context.returnValue,
		        ...result
		    };
		}
	`)
})

test('both beforeLoad and afterLoad hooks', async function () {
	const route = await route_test({
		script: `
			export async function _houdini_beforeLoad(){
			return this.redirect(302, "/test")
			}

			export async function _houdini_afterLoad(){
			   return this.redirect(302, "/test")
			}

			export function _TestQueryVariables(page) {
				return {
					test: true
				}
			}
		`,
		component: `
			<script>
				$: result = graphql\`
					query TestQuery($test: Boolean!) @load {
						viewer {
							id
						}
					}
				\`
			</script>
		`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { load_TestQuery } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { parseScalar, marshalInputs } from "$houdini/runtime/lib/scalars";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";

		export async function _houdini_beforeLoad() {
		    return this.redirect(302, "/test");
		}

		export async function _houdini_afterLoad() {
		    return this.redirect(302, "/test");
		}

		export function _TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		async function __houdini___TestQueryVariables(config, event) {
		    const result = {};

		    Object.assign(result, marshalInputs({
		        config: config,
		        input: await _TestQueryVariables(event),
		        artifact: _TestQueryArtifact
		    }));

		    return result;
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);

		    await houdini_context.invokeLoadHook({
		        "variant": "before",
		        "hookFn": _houdini_beforeLoad
		    });

		    const houdiniConfig = getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["TestQuery"] = await __houdini___TestQueryVariables(houdiniConfig, context);

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": true
		    }));

		    let result = {};

		    try {
		        result = Object.assign({}, ...(await Promise.all(promises)));
		    } catch (err) {
		        throw err;
		    }

		    await houdini_context.invokeLoadHook({
		        "variant": "after",
		        "hookFn": _houdini_afterLoad,
		        "input": inputs,
		        "data": result
		    });

		    return {
		        ...houdini_context.returnValue,
		        ...result
		    };
		}
	`)
})

test('layout loads', async function () {
	const route = await route_test({
		layout_script: `
			const store1 = graphql\`
				query MyQuery1 {
					field
				}
			\`

			const store2 = graphql\`
				query MyQuery2($input: Int) {
					field(input: $input)
				}
			\`

			export function _MyQuery2Variables() {

			}

			export const _houdini_load = [store1, store2]
		`,
	})

	expect(route.layout_script).toMatchInlineSnapshot(`
		import { MyQuery2Store } from "$houdini/plugins/houdini-svelte/stores/MyQuery2";
		import { MyQuery1Store } from "$houdini/plugins/houdini-svelte/stores/MyQuery1";
		import { load_MyQuery2 } from "$houdini/plugins/houdini-svelte/stores/MyQuery2";
		import { load_MyQuery1 } from "$houdini/plugins/houdini-svelte/stores/MyQuery1";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import _MyQuery2Artifact from "$houdini/artifacts/MyQuery2";
		import { parseScalar, marshalInputs } from "$houdini/runtime/lib/scalars";
		const store1 = new MyQuery1Store();
		const store2 = new MyQuery2Store();
		export function _MyQuery2Variables() {}
		export const _houdini_load = [store1, store2];

		async function __houdini___MyQuery2Variables(config, event) {
		    const result = {};

		    Object.assign(result, marshalInputs({
		        config: config,
		        input: await _MyQuery2Variables(event),
		        artifact: _MyQuery2Artifact
		    }));

		    return result;
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const houdiniConfig = getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["MyQuery1"] = {};

		    promises.push(load_MyQuery1({
		        "variables": inputs["MyQuery1"],
		        "event": context,
		        "blocking": undefined
		    }));

		    inputs["MyQuery2"] = await __houdini___MyQuery2Variables(houdiniConfig, context);

		    promises.push(load_MyQuery2({
		        "variables": inputs["MyQuery2"],
		        "event": context,
		        "blocking": undefined
		    }));

		    let result = {};

		    try {
		        result = Object.assign({}, ...(await Promise.all(promises)));
		    } catch (err) {
		        throw err;
		    }

		    const __houdini__vite__plugin__return__value__ = {
		        ...houdini_context.returnValue,
		        ...result
		    };

		    return {
		        ...context.data,
		        ...__houdini__vite__plugin__return__value__
		    };
		}
	`)

	expect(route.layout).toMatchInlineSnapshot(`
		import { page } from "$app/stores";
		import { extractSession, setClientSession } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { onMount } from "svelte";
		import { setClientStarted } from "$houdini/plugins/houdini-svelte/runtime/adapter";
		onMount(() => setClientStarted());

		page.subscribe(val => {
		    setClientSession(extractSession(val.data));
		});
	`)
})

test('layout inline query', async function () {
	const route = await route_test({
		layout: `
			<script>
				$: result = graphql\`
					query TestQuery @load {
						viewer {
							id
						}
					}
				\`
			</script>
		`,
	})

	expect(route.layout).toMatchInlineSnapshot(`
		import { page } from "$app/stores";
		import { extractSession, setClientSession } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { onMount } from "svelte";
		import { setClientStarted } from "$houdini/plugins/houdini-svelte/runtime/adapter";
		export let data;

		$:
		result = data.TestQuery;

		onMount(() => setClientStarted());

		page.subscribe(val => {
		    setClientSession(extractSession(val.data));
		});
	`)

	expect(route.layout_script).toMatchInlineSnapshot(`
		import { load_TestQuery } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const houdiniConfig = getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["TestQuery"] = {};

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": undefined
		    }));

		    let result = {};

		    try {
		        result = Object.assign({}, ...(await Promise.all(promises)));
		    } catch (err) {
		        throw err;
		    }

		    const __houdini__vite__plugin__return__value__ = {
		        ...houdini_context.returnValue,
		        ...result
		    };

		    return {
		        ...context.data,
		        ...__houdini__vite__plugin__return__value__
		    };
		}
	`)
})

test('inline function query', async function () {
	const route = await route_test({
		component: `
			<script>
				$: result = graphql(\`
					query TestQuery @load {
						viewer {
							id
						}
					}
				\`)
			</script>
		`,
	})

	expect(route.component).toMatchInlineSnapshot(`
		export let data;

		$:
		result = data.TestQuery;
	`)

	expect(route.script).toMatchInlineSnapshot(`
		import { load_TestQuery } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const houdiniConfig = getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["TestQuery"] = {};

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": undefined
		    }));

		    let result = {};

		    try {
		        result = Object.assign({}, ...(await Promise.all(promises)));
		    } catch (err) {
		        throw err;
		    }

		    return {
		        ...houdini_context.returnValue,
		        ...result
		    };
		}
	`)
})

test('onError hook', async function () {
	const route = await route_test({
		script: `
				export async function _houdini_onError(){
				   return this.redirect(302, "/test")
				}

				export function _TestQueryVariables(page) {
					return {
						test: true
					}
				}
		`,
		component: `
				<script>
					$: result = graphql\`
						query TestQuery($test: Boolean!) @load {
							viewer {
								id
							}
						}
					\`
				</script>
			`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { load_TestQuery } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { parseScalar, marshalInputs } from "$houdini/runtime/lib/scalars";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";

		export async function _houdini_onError() {
		    return this.redirect(302, "/test");
		}

		export function _TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		async function __houdini___TestQueryVariables(config, event) {
		    const result = {};

		    Object.assign(result, marshalInputs({
		        config: config,
		        input: await _TestQueryVariables(event),
		        artifact: _TestQueryArtifact
		    }));

		    return result;
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const houdiniConfig = getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["TestQuery"] = await __houdini___TestQueryVariables(houdiniConfig, context);

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": true
		    }));

		    let result = {};

		    try {
		        result = Object.assign({}, ...(await Promise.all(promises)));
		    } catch (err) {
		        await houdini_context.invokeLoadHook({
		            "variant": "error",
		            "hookFn": _houdini_onError,
		            "error": err,
		            "input": inputs
		        });
		    }

		    return {
		        ...houdini_context.returnValue,
		        ...result
		    };
		}
	`)
})

test('route params, no variable function', async function () {
	const route = await route_test({
		route_path: '[userID]/profile',
		script: `
			export const _houdini_load = graphql(\`
				query UserInfo($userID: ID!) {
					user(id: $userID) {
						firstName
					}
				}
			\`)
		`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { UserInfoStore } from "$houdini/plugins/houdini-svelte/stores/UserInfo";
		import { load_UserInfo } from "$houdini/plugins/houdini-svelte/stores/UserInfo";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { parseScalar, marshalInputs } from "$houdini/runtime/lib/scalars";
		export const _houdini_load = new UserInfoStore();

		async function __houdini___UserInfoVariables(config, event) {
		    const result = {
		        userID: parseScalar(config, "ID", event.params.userID)
		    };

		    return result;
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const houdiniConfig = getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["UserInfo"] = await __houdini___UserInfoVariables(houdiniConfig, context);

		    promises.push(load_UserInfo({
		        "variables": inputs["UserInfo"],
		        "event": context,
		        "blocking": undefined
		    }));

		    let result = {};

		    try {
		        result = Object.assign({}, ...(await Promise.all(promises)));
		    } catch (err) {
		        throw err;
		    }

		    return {
		        ...houdini_context.returnValue,
		        ...result
		    };
		}
	`)
})

test('route params with variable function', async function () {
	const route = await route_test({
		route_path: '[userID]/profile',
		script: `
			export const _houdini_load = graphql(\`
				query UserInfo($userID: ID!) {
					user(id: $userID) {
						firstName
					}
				}
			\`)

			export function _UserInfoVariables(event) {
				return {
					userID: '1'
				}
			}
		`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { UserInfoStore } from "$houdini/plugins/houdini-svelte/stores/UserInfo";
		import { load_UserInfo } from "$houdini/plugins/houdini-svelte/stores/UserInfo";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import _UserInfoArtifact from "$houdini/artifacts/UserInfo";
		import { parseScalar, marshalInputs } from "$houdini/runtime/lib/scalars";
		export const _houdini_load = new UserInfoStore();

		export function _UserInfoVariables(event) {
		    return {
		        userID: "1"
		    };
		}

		async function __houdini___UserInfoVariables(config, event) {
		    const result = {
		        userID: parseScalar(config, "ID", event.params.userID)
		    };

		    Object.assign(result, marshalInputs({
		        config: config,
		        input: await _UserInfoVariables(event),
		        artifact: _UserInfoArtifact
		    }));

		    return result;
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const houdiniConfig = getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["UserInfo"] = await __houdini___UserInfoVariables(houdiniConfig, context);

		    promises.push(load_UserInfo({
		        "variables": inputs["UserInfo"],
		        "event": context,
		        "blocking": undefined
		    }));

		    let result = {};

		    try {
		        result = Object.assign({}, ...(await Promise.all(promises)));
		    } catch (err) {
		        throw err;
		    }

		    return {
		        ...houdini_context.returnValue,
		        ...result
		    };
		}
	`)
})

test.todo('overlapping query parameters')
test('existing loads with parens', async function () {
	const route = await route_test({
		script: `
			import type { LayoutServerLoad } from "./$types";

			export const load = (() => ({ test: "Hello" })) satisfies LayoutServerLoad;
			`,
		component: `
				<script>
					$: result = graphql\`
						query TestQuery1 @load {
							viewer {
								id
							}
						}
					\`
				</script>
			`,
	})

	// make sure we added the right stuff
	expect(route.script).toMatchInlineSnapshot(`
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
		import type { LayoutServerLoad } from "./$types";

		export const load = (() => ({
		    test: "Hello"
		})) satisfies LayoutServerLoad;
	`)
})
