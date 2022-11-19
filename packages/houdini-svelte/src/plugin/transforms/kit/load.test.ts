import { test, expect, describe } from 'vitest'

import { route_test } from '../../../test'

describe('kit route processor', function () {
	test('inline store', async function () {
		const route = await route_test({
			component: `
				<script>
					const store = graphql\`
						query TestQuery {
							viewer {
								id
							}
						}
					\`


				</script>
			`,
		})
		expect(route.component).toMatchInlineSnapshot(`
			export let data;

			$:
			store = data.TestQuery;
		`)
	})

	test('inline query', async function () {
		const route = await route_test({
			component: `
				<script>
					const result = graphql\`
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
			export let data;

			$:
			result = data.TestQuery;
		`)
		expect(route.script).toMatchInlineSnapshot(`
			import { load_TestQuery } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
			import GQL_TestQuery from "$houdini/plugins/houdini-svelte/stores/TestQuery";

			export async function load(context) {
			    const houdini_context = new RequestContext(context);
			    const houdiniConfig = await getCurrentConfig();
			    const promises = [];
			    const inputs = {};
			    inputs["TestQuery"] = {};

			    promises.push(load_TestQuery({
			        "variables": inputs["TestQuery"],
			        "event": context,
			        "blocking": false
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
					const result = graphql\`
						query TestQuery @houdini(load: false) {
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
			import GQL_TestQuery from "$houdini/plugins/houdini-svelte/stores/TestQuery";

			$:
			result = GQL_TestQuery;
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
						const result = graphql\`
							query TestQuery1 {
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
			import GQL_TestQuery1 from "$houdini/plugins/houdini-svelte/stores/TestQuery1";
			export async function load() {}
		`)
	})

	test('multiple inline queries', async function () {
		const route = await route_test({
			component: `
				<script>
					const data1 = graphql\`
						query TestQuery1 {
							viewer {
								id
							}
						}
					\`
					const data2 = graphql\`
						query TestQuery2 {
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
			import GQL_TestQuery2 from "$houdini/plugins/houdini-svelte/stores/TestQuery2";
			import GQL_TestQuery1 from "$houdini/plugins/houdini-svelte/stores/TestQuery1";

			export async function load(context) {
			    const houdini_context = new RequestContext(context);
			    const houdiniConfig = await getCurrentConfig();
			    const promises = [];
			    const inputs = {};
			    inputs["TestQuery1"] = {};

			    promises.push(load_TestQuery1({
			        "variables": inputs["TestQuery1"],
			        "event": context,
			        "blocking": false
			    }));

			    inputs["TestQuery2"] = {};

			    promises.push(load_TestQuery2({
			        "variables": inputs["TestQuery2"],
			        "event": context,
			        "blocking": false
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
					export async function TestQueryVariables(page) {
						return {
							test: true
						}
					}
				`,
			component: `
					<script>
						const data1 = graphql\`
							query TestQuery($test: Boolean!) {
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
			import GQL_TestQuery from "$houdini/plugins/houdini-svelte/stores/TestQuery";

			export async function TestQueryVariables(page) {
			    return {
			        test: true
			    };
			}

			export async function load(context) {
			    const houdini_context = new RequestContext(context);
			    const houdiniConfig = await getCurrentConfig();
			    const promises = [];
			    const inputs = {};

			    inputs["TestQuery"] = await houdini_context.computeInput({
			        "config": houdiniConfig,
			        "variableFunction": TestQueryVariables,
			        "artifact": GQL_TestQuery.artifact
			    });

			    promises.push(load_TestQuery({
			        "variables": inputs["TestQuery"],
			        "event": context,
			        "blocking": false
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
						const test = graphql\`
							query TestQuery {
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
			import { marshalInputs } from "$houdini/runtime/lib/scalars";
			const _houdini_TestQuery = new TestQueryStore();

			$:
			test = _houdini_TestQuery;

			$:
			marshalInputs({
			    artifact: _houdini_TestQuery.artifact,
			    input: {}
			}).then(_TestQuery_Input => isBrowser && _houdini_TestQuery.fetch({
			    variables: _TestQuery_Input
			}));
		`)
	})

	test('route with page stores and inline queries', async function () {
		const MyQuery1 = `
			query MyQuery1 {
				field
			}
		`

		const MyQuery2 = `
			query MyQuery2($input: Int) {
				field(input: $input)
			}
		`

		const route = await route_test({
			component: `
				<script>
					const result = graphql\`
						query TestQuery {
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

				export function MyQuery2Variables() {

				}

				export const houdini_load = [store1, store2]
			`,
		})

		expect(route.component).toMatchInlineSnapshot(`
			export let data;

			$:
			result = data.TestQuery;
		`)
		expect(route.script).toMatchInlineSnapshot(`
			import GQL_MyQuery1 from "$houdini/plugins/houdini-svelte/stores/MyQuery1";
			import { load_TestQuery } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
			import GQL_MyQuery2 from "$houdini/plugins/houdini-svelte/stores/MyQuery2";
			import { load_MyQuery2 } from "$houdini/plugins/houdini-svelte/stores/MyQuery2";
			import { load_MyQuery1 } from "$houdini/plugins/houdini-svelte/stores/MyQuery1";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
			import GQL_TestQuery from "$houdini/plugins/houdini-svelte/stores/TestQuery";
			const store1 = GQL_MyQuery1;
			const store2 = GQL_MyQuery2;
			export function MyQuery2Variables() {}
			export const houdini_load = [store1, store2];

			export async function load(context) {
			    const houdini_context = new RequestContext(context);
			    const houdiniConfig = await getCurrentConfig();
			    const promises = [];
			    const inputs = {};
			    inputs["MyQuery1"] = {};

			    promises.push(load_MyQuery1({
			        "variables": inputs["MyQuery1"],
			        "event": context,
			        "blocking": false
			    }));

			    inputs["MyQuery2"] = await houdini_context.computeInput({
			        "config": houdiniConfig,
			        "variableFunction": MyQuery2Variables,
			        "artifact": GQL_MyQuery2.artifact
			    });

			    promises.push(load_MyQuery2({
			        "variables": inputs["MyQuery2"],
			        "event": context,
			        "blocking": false
			    }));

			    inputs["TestQuery"] = {};

			    promises.push(load_TestQuery({
			        "variables": inputs["TestQuery"],
			        "event": context,
			        "blocking": false
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

		expect(route.component).toMatchInlineSnapshot(
			'import GQL_TestPageQuery from "$houdini/plugins/houdini-svelte/stores/TestPageQuery";'
		)

		expect(route.script).toMatchInlineSnapshot(`
			import { load_TestPageQuery } from "$houdini/plugins/houdini-svelte/stores/TestPageQuery";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
			import GQL_TestPageQuery from "$houdini/plugins/houdini-svelte/stores/TestPageQuery";

			export async function load(context) {
			    const houdini_context = new RequestContext(context);
			    const houdiniConfig = await getCurrentConfig();
			    const promises = [];
			    const inputs = {};
			    inputs["TestPageQuery"] = {};

			    promises.push(load_TestPageQuery({
			        "variables": inputs["TestPageQuery"],
			        "event": context,
			        "blocking": false
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
			import GQL_TestPageQuery from "$houdini/plugins/houdini-svelte/stores/TestPageQuery";
			onMount(() => setClientStarted());

			page.subscribe(val => {
			    setClientSession(extractSession(val.data));
			});
		`)

		expect(route.layout_script).toMatchInlineSnapshot(`
			import GQL_TestPageQuery from "$houdini/plugins/houdini-svelte/stores/TestPageQuery";

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

		expect(route.component).toMatchInlineSnapshot(
			'import GQL_TestLayoutQuery from "$houdini/plugins/houdini-svelte/stores/TestLayoutQuery";'
		)

		expect(route.script).toMatchInlineSnapshot(
			'import GQL_TestLayoutQuery from "$houdini/plugins/houdini-svelte/stores/TestLayoutQuery";'
		)

		expect(route.layout).toMatchInlineSnapshot(`
			import { page } from "$app/stores";
			import { extractSession, setClientSession } from "$houdini/plugins/houdini-svelte/runtime/session";
			import { onMount } from "svelte";
			import { setClientStarted } from "$houdini/plugins/houdini-svelte/runtime/adapter";
			import GQL_TestLayoutQuery from "$houdini/plugins/houdini-svelte/stores/TestLayoutQuery";
			onMount(() => setClientStarted());

			page.subscribe(val => {
			    setClientSession(extractSession(val.data));
			});
		`)

		expect(route.layout_script).toMatchInlineSnapshot(`
			import { load_TestLayoutQuery } from "$houdini/plugins/houdini-svelte/stores/TestLayoutQuery";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
			import GQL_TestLayoutQuery from "$houdini/plugins/houdini-svelte/stores/TestLayoutQuery";

			export async function load(context) {
			    const houdini_context = new RequestContext(context);
			    const houdiniConfig = await getCurrentConfig();
			    const promises = [];
			    const inputs = {};
			    inputs["TestLayoutQuery"] = {};

			    promises.push(load_TestLayoutQuery({
			        "variables": inputs["TestLayoutQuery"],
			        "event": context,
			        "blocking": false
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
			export async function beforeLoad(){
				return this.redirect(302, "/test")
			}

			export function TestQueryVariables(page) {
				return {
					test: true
				}
			}
		`,
		component: `
				<script>
					const result = graphql\`
						query TestQuery($test: Boolean!) {
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
		import GQL_TestQuery from "$houdini/plugins/houdini-svelte/stores/TestQuery";

		export async function beforeLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);

		    await houdini_context.invokeLoadHook({
		        "variant": "before",
		        "hookFn": beforeLoad
		    });

		    const houdiniConfig = await getCurrentConfig();
		    const promises = [];
		    const inputs = {};

		    inputs["TestQuery"] = await houdini_context.computeInput({
		        "config": houdiniConfig,
		        "variableFunction": TestQueryVariables,
		        "artifact": GQL_TestQuery.artifact
		    });

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": false
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
			export async function beforeLoad(){
				return this.redirect(302, "/test")
			}

			export function TestQueryVariables(page) {
				return {
					test: true
				}
			}
		`,
		component: `
				<script>
					const { data: data1 } = graphql\`
						query TestQuery1 {
							viewer {
								id
							}
						}
					\`
					const { data: data2 } = graphql\`
						query TestQuery2 {
							viewer {
								id
							}
						}
					\`
				</script>
			`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { load_TestQuery2 } from "$houdini/plugins/houdini-svelte/stores/TestQuery2";
		import { load_TestQuery1 } from "$houdini/plugins/houdini-svelte/stores/TestQuery1";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import GQL_TestQuery2 from "$houdini/plugins/houdini-svelte/stores/TestQuery2";
		import GQL_TestQuery1 from "$houdini/plugins/houdini-svelte/stores/TestQuery1";

		export async function beforeLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);

		    await houdini_context.invokeLoadHook({
		        "variant": "before",
		        "hookFn": beforeLoad
		    });

		    const houdiniConfig = await getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["TestQuery1"] = {};

		    promises.push(load_TestQuery1({
		        "variables": inputs["TestQuery1"],
		        "event": context,
		        "blocking": false
		    }));

		    inputs["TestQuery2"] = {};

		    promises.push(load_TestQuery2({
		        "variables": inputs["TestQuery2"],
		        "event": context,
		        "blocking": false
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
				export async function afterLoad(){
				   return this.redirect(302, "/test")
				}

				export function TestQueryVariables(page) {
					return {
						test: true
					}
				}
		`,
		component: `
				<script>
					const result = graphql\`
						query TestQuery($test: Boolean!) {
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
		import GQL_TestQuery from "$houdini/plugins/houdini-svelte/stores/TestQuery";

		export async function afterLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const houdiniConfig = await getCurrentConfig();
		    const promises = [];
		    const inputs = {};

		    inputs["TestQuery"] = await houdini_context.computeInput({
		        "config": houdiniConfig,
		        "variableFunction": TestQueryVariables,
		        "artifact": GQL_TestQuery.artifact
		    });

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
		        "hookFn": afterLoad,
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
			export async function afterLoad(){
			   return this.redirect(302, "/test")
			}

			export function TestQueryVariables(page) {
				return {
					test: true
				}
			}
		`,
		component: `
			<script>
				const { data: data1 } = graphql\`
					query TestQuery1 {
						viewer {
							id
						}
					}
				\`
				const { data: data2 } = graphql\`
					query TestQuery2 {
						viewer {
							id
						}
					}
				\`
			</script>
		`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { load_TestQuery2 } from "$houdini/plugins/houdini-svelte/stores/TestQuery2";
		import { load_TestQuery1 } from "$houdini/plugins/houdini-svelte/stores/TestQuery1";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import GQL_TestQuery2 from "$houdini/plugins/houdini-svelte/stores/TestQuery2";
		import GQL_TestQuery1 from "$houdini/plugins/houdini-svelte/stores/TestQuery1";

		export async function afterLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const houdiniConfig = await getCurrentConfig();
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
		        "hookFn": afterLoad,
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
		`,
		component: `
			<script>
				const result = graphql\`
					query TestQuery($test: Boolean!) {
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
		import GQL_TestQuery from "$houdini/plugins/houdini-svelte/stores/TestQuery";

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
		    const houdini_context = new RequestContext(context);

		    await houdini_context.invokeLoadHook({
		        "variant": "before",
		        "hookFn": beforeLoad
		    });

		    const houdiniConfig = await getCurrentConfig();
		    const promises = [];
		    const inputs = {};

		    inputs["TestQuery"] = await houdini_context.computeInput({
		        "config": houdiniConfig,
		        "variableFunction": TestQueryVariables,
		        "artifact": GQL_TestQuery.artifact
		    });

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
		        "hookFn": afterLoad,
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

			export function MyQuery2Variables() {

			}

			export const houdini_load = [store1, store2]
		`,
	})

	expect(route.layout_script).toMatchInlineSnapshot(`
		import GQL_MyQuery1 from "$houdini/plugins/houdini-svelte/stores/MyQuery1";
		import GQL_MyQuery2 from "$houdini/plugins/houdini-svelte/stores/MyQuery2";
		import { load_MyQuery2 } from "$houdini/plugins/houdini-svelte/stores/MyQuery2";
		import { load_MyQuery1 } from "$houdini/plugins/houdini-svelte/stores/MyQuery1";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		const store1 = GQL_MyQuery1;
		const store2 = GQL_MyQuery2;
		export function MyQuery2Variables() {}
		export const houdini_load = [store1, store2];

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const houdiniConfig = await getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["MyQuery1"] = {};

		    promises.push(load_MyQuery1({
		        "variables": inputs["MyQuery1"],
		        "event": context,
		        "blocking": false
		    }));

		    inputs["MyQuery2"] = await houdini_context.computeInput({
		        "config": houdiniConfig,
		        "variableFunction": MyQuery2Variables,
		        "artifact": GQL_MyQuery2.artifact
		    });

		    promises.push(load_MyQuery2({
		        "variables": inputs["MyQuery2"],
		        "event": context,
		        "blocking": false
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
				const result = graphql\`
					query TestQuery {
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
		import GQL_TestQuery from "$houdini/plugins/houdini-svelte/stores/TestQuery";

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const houdiniConfig = await getCurrentConfig();
		    const promises = [];
		    const inputs = {};
		    inputs["TestQuery"] = {};

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": false
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

test('onError hook', async function () {
	const route = await route_test({
		script: `
				export async function onError(){
				   return this.redirect(302, "/test")
				}

				export function TestQueryVariables(page) {
					return {
						test: true
					}
				}
		`,
		component: `
				<script>
					const result = graphql\`
						query TestQuery($test: Boolean!) {
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
		import GQL_TestQuery from "$houdini/plugins/houdini-svelte/stores/TestQuery";

		export async function onError() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const houdiniConfig = await getCurrentConfig();
		    const promises = [];
		    const inputs = {};

		    inputs["TestQuery"] = await houdini_context.computeInput({
		        "config": houdiniConfig,
		        "variableFunction": TestQueryVariables,
		        "artifact": GQL_TestQuery.artifact
		    });

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
		            "hookFn": onError,
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
