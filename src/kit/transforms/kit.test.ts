import '../../../jest.setup'
import { route_test } from '../tests'

describe('kit route processor', function () {
	test('inline query', async function () {
		const route = await route_test({
			component: `
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
		})

		// make sure we added the right stuff
		expect(route.component).toMatchInlineSnapshot(`
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";

		const {
		    data
		} = query(GQL_TestQuery);

		const _houdini_context_DO_NOT_USE = getHoudiniContext();

		$:
		isBrowser && GQL_TestQuery.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: inputs["TestQuery"]
		});
	`)
		expect(route.script).toMatchInlineSnapshot(`
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";
		import { load_TestQuery } from "$houdini/stores/TestQuery";
		import { RequestContext } from "$houdini/runtime/lib/network";

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const promises = [];
		    const inputs = {};
		    inputs["TestQuery"] = {};

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": false
		    }));

		    const result = Object.assign({}, ...(await Promise.all(promises)));

		    return {
		        ...houdini_context.returnValue,
		        ...result
		    };
		}
	`)
	})

	test("existing loads aren't modified", async function () {
		const route = await route_test({
			script: `
					export async function load() {

					}
				`,
			script_info: {
				exports: ['load'],
			},
			component: `
					<script>
						const { data } = query(graphql\`
							query TestQuery1 {
								viewer {
									id
								}
							}
						\`)
					</script>
				`,
		})

		// make sure we added the right stuff
		expect(route.script).toMatchInlineSnapshot(`export async function load() {}`)
	})

	test('multiple inline queries', async function () {
		const route = await route_test({
			component: `
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
			`,
		})

		// make sure we added the right stuff
		expect(route.component).toMatchInlineSnapshot(`
		import { GQL_TestQuery2 } from "$houdini/stores/TestQuery2";
		import { GQL_TestQuery1 } from "$houdini/stores/TestQuery1";
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";

		const {
		    data: data1
		} = query(GQL_TestQuery1);

		const {
		    data: data2
		} = query(GQL_TestQuery2);

		const _houdini_context_DO_NOT_USE = getHoudiniContext();

		$:
		isBrowser && GQL_TestQuery1.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: inputs["TestQuery1"]
		});

		$:
		isBrowser && GQL_TestQuery2.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: inputs["TestQuery2"]
		});
	`)
		expect(route.script).toMatchInlineSnapshot(`
		import { GQL_TestQuery2 } from "$houdini/stores/TestQuery2";
		import { load_TestQuery2 } from "$houdini/stores/TestQuery2";
		import { GQL_TestQuery1 } from "$houdini/stores/TestQuery1";
		import { load_TestQuery1 } from "$houdini/stores/TestQuery1";
		import { RequestContext } from "$houdini/runtime/lib/network";

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
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

		    const result = Object.assign({}, ...(await Promise.all(promises)));

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
					export function TestQueryVariables(page) {
						return {
							test: true
						}
					}
				`,
			script_info: {
				exports: ['TestQueryVariables'],
			},
			component: `
					<script>
						const { data } = query(graphql\`
							query TestQuery($test: Boolean!) {
								viewer {
									id
								}
							}
						\`)
					</script>
				`,
		})

		// make sure we added the right stuff
		expect(route.script).toMatchInlineSnapshot(`
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";
		import { load_TestQuery } from "$houdini/stores/TestQuery";
		import { RequestContext } from "$houdini/runtime/lib/network";

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const promises = [];
		    const inputs = {};

		    inputs["TestQuery"] = houdini_context.computeInput({
		        "config": houdiniConfig,
		        "variableFunction": TestQueryVariables,
		        "artifact": GQL_TestQuery.artifact
		    });

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": false
		    }));

		    const result = Object.assign({}, ...(await Promise.all(promises)));

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
						const { data } = query(graphql\`
							query TestQuery {
								viewer {
									id
								}
							}
						\`)
					</script>
				`,
			config: {
				framework: 'svelte',
			},
		})

		// make sure we added the right stuff
		expect(route.component).toMatchInlineSnapshot(`
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";

		const {
		    data
		} = query(GQL_TestQuery);

		const _houdini_context_DO_NOT_USE = getHoudiniContext();
		const _TestQuery_Input = {};

		$:
		isBrowser && GQL_TestQuery.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: _TestQuery_Input
		});
	`)
	})

	test('route with page stores and inline queries', async function () {
		const route = await route_test({
			component: `
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
			script: `
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
			script_info: {
				// neither query _require_ variables. we need to look at the file's
				// exports when generating the load function to centralize the logic
				// across inline, page, and load queries
				exports: ['MyQuery2Variables', 'houdini_load'],
				load: [
					{ name: 'MyQuery1', variables: false },
					{ name: 'MyQuery2', variables: false },
				],
			},
		})

		expect(route.component).toMatchInlineSnapshot(`
		import { GQL_MyQuery2 } from "$houdini/stores/MyQuery2";
		import { GQL_MyQuery1 } from "$houdini/stores/MyQuery1";
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";

		const {
		    data
		} = query(GQL_TestQuery);

		const _houdini_context_DO_NOT_USE = getHoudiniContext();

		$:
		isBrowser && GQL_TestQuery.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: inputs["TestQuery"]
		});

		$:
		isBrowser && GQL_MyQuery1.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: inputs["MyQuery1"]
		});

		$:
		isBrowser && GQL_MyQuery2.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: inputs["MyQuery2"]
		});
	`)
		expect(route.script).toMatchInlineSnapshot(`
		import { GQL_MyQuery2 } from "$houdini/stores/MyQuery2";
		import { load_MyQuery2 } from "$houdini/stores/MyQuery2";
		import { GQL_MyQuery1 } from "$houdini/stores/MyQuery1";
		import { load_MyQuery1 } from "$houdini/stores/MyQuery1";
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";
		import { load_TestQuery } from "$houdini/stores/TestQuery";
		import { RequestContext } from "$houdini/runtime/lib/network";
		const store1 = GQL_MyQuery1;
		const store2 = GQL_MyQuery2;
		export function MyQuery2Variables() {}
		export const houdini_load = [store1, store2];

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const promises = [];
		    const inputs = {};
		    inputs["TestQuery"] = {};

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": false
		    }));

		    inputs["MyQuery1"] = {};

		    promises.push(load_MyQuery1({
		        "variables": inputs["MyQuery1"],
		        "event": context,
		        "blocking": false
		    }));

		    inputs["MyQuery2"] = houdini_context.computeInput({
		        "config": houdiniConfig,
		        "variableFunction": MyQuery2Variables,
		        "artifact": GQL_MyQuery2.artifact
		    });

		    promises.push(load_MyQuery2({
		        "variables": inputs["MyQuery2"],
		        "event": context,
		        "blocking": false
		    }));

		    const result = Object.assign({}, ...(await Promise.all(promises)));

		    return {
		        ...houdini_context.returnValue,
		        ...result
		    };
		}
	`)
	})

	test('route with page query', async function () {
		const route = await route_test({
			query: `
				query TestQuery {
					viewer {
						id
					}
				}
			`,
		})

		expect(route.component).toMatchInlineSnapshot(`
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";
		const _houdini_context_DO_NOT_USE = getHoudiniContext();

		$:
		isBrowser && GQL_TestQuery.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: inputs["TestQuery"]
		});
	`)
		expect(route.script).toMatchInlineSnapshot(`
		import { load_TestQuery } from "$houdini/stores/TestQuery";
		import { RequestContext } from "$houdini/runtime/lib/network";
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";

		export async function load(context) {
		    const houdini_context = new RequestContext(context);
		    const promises = [];
		    const inputs = {};
		    inputs["TestQuery"] = {};

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": false
		    }));

		    const result = Object.assign({}, ...(await Promise.all(promises)));

		    return {
		        ...houdini_context.returnValue,
		        ...result
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
		script_info: {
			exports: ['beforeLoad', 'TestQueryVariables'],
		},
		component: `
				<script>
					const { data } = query(graphql\`
						query TestQuery($test: Boolean!) {
							viewer {
								id
							}
						}
					\`)
				</script>
			`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";
		import { load_TestQuery } from "$houdini/stores/TestQuery";
		import { RequestContext } from "$houdini/runtime/lib/network";

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

		    const promises = [];
		    const inputs = {};

		    inputs["TestQuery"] = houdini_context.computeInput({
		        "config": houdiniConfig,
		        "variableFunction": TestQueryVariables,
		        "artifact": GQL_TestQuery.artifact
		    });

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": false
		    }));

		    const result = Object.assign({}, ...(await Promise.all(promises)));

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
		script_info: {
			exports: ['beforeLoad', 'TestQueryVariables'],
		},
		component: `
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
			`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { GQL_TestQuery2 } from "$houdini/stores/TestQuery2";
		import { load_TestQuery2 } from "$houdini/stores/TestQuery2";
		import { GQL_TestQuery1 } from "$houdini/stores/TestQuery1";
		import { load_TestQuery1 } from "$houdini/stores/TestQuery1";
		import { RequestContext } from "$houdini/runtime/lib/network";

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

		    const result = Object.assign({}, ...(await Promise.all(promises)));

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
		script_info: {
			exports: ['afterLoad', 'TestQueryVariables'],
		},
		component: `
				<script>
					const { data } = query(graphql\`
						query TestQuery($test: Boolean!) {
							viewer {
								id
							}
						}
					\`)
				</script>
			`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";
		import { load_TestQuery } from "$houdini/stores/TestQuery";
		import { RequestContext } from "$houdini/runtime/lib/network";

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
		    const promises = [];
		    const inputs = {};

		    inputs["TestQuery"] = houdini_context.computeInput({
		        "config": houdiniConfig,
		        "variableFunction": TestQueryVariables,
		        "artifact": GQL_TestQuery.artifact
		    });

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": true
		    }));

		    const result = Object.assign({}, ...(await Promise.all(promises)));

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
		script_info: {
			exports: ['afterLoad', 'TestQueryVariables'],
		},
		component: `
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
		`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { GQL_TestQuery2 } from "$houdini/stores/TestQuery2";
		import { load_TestQuery2 } from "$houdini/stores/TestQuery2";
		import { GQL_TestQuery1 } from "$houdini/stores/TestQuery1";
		import { load_TestQuery1 } from "$houdini/stores/TestQuery1";
		import { RequestContext } from "$houdini/runtime/lib/network";

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

		    const result = Object.assign({}, ...(await Promise.all(promises)));

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
		script_info: {
			exports: ['afterLoad', 'TestQueryVariables', 'beforeLoad'],
		},
		component: `
			<script>
				const { data } = query(graphql\`
					query TestQuery($test: Boolean!) {
						viewer {
							id
						}
					}
				\`)
			</script>
		`,
	})

	expect(route.script).toMatchInlineSnapshot(`
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";
		import { load_TestQuery } from "$houdini/stores/TestQuery";
		import { RequestContext } from "$houdini/runtime/lib/network";

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

		    const promises = [];
		    const inputs = {};

		    inputs["TestQuery"] = houdini_context.computeInput({
		        "config": houdiniConfig,
		        "variableFunction": TestQueryVariables,
		        "artifact": GQL_TestQuery.artifact
		    });

		    promises.push(load_TestQuery({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": true
		    }));

		    const result = Object.assign({}, ...(await Promise.all(promises)));

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
