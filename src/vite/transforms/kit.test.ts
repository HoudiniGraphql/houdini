// local imports
import '../../../jest.setup'
import { routeTest } from '../tests'

describe('kit route processor', function () {
	test('inline query', async function () {
		const route = await routeTest({
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

		const {
		    data
		} = query(GQL_TestQuery);
	`)
		expect(route.script).toMatchInlineSnapshot(`
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";

		export async function load(context) {
		    const houdini_context = new request_context(context);
		    const inputs = {};
		    const promises = [];
		    inputs["TestQuery"] = {};

		    promises.push(GQL_TestQuery.fetch({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": false
		    }));

		    const result = await Promise.all(promises);

		    return {
		        ...houdini_context.returnValue,
		        inputs: inputs
		    };
		}
	`)
	})

	test("existing loads aren't modified", async function () {
		const route = await routeTest({
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
		expect(route.script).toMatchInlineSnapshot(`
			import { GQL_TestQuery1 } from "$houdini/stores/TestQuery1";
			export async function load() {}
		`)
	})

	test('multiple inline queries', async function () {
		const route = await routeTest({
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

			const {
			    data: data1
			} = query(GQL_TestQuery1);

			const {
			    data: data2
			} = query(GQL_TestQuery2);
		`)
		expect(route.script).toMatchInlineSnapshot(`
		import { GQL_TestQuery2 } from "$houdini/stores/TestQuery2";
		import { GQL_TestQuery1 } from "$houdini/stores/TestQuery1";

		export async function load(context) {
		    const houdini_context = new request_context(context);
		    const inputs = {};
		    const promises = [];
		    inputs["TestQuery1"] = {};

		    promises.push(GQL_TestQuery1.fetch({
		        "variables": inputs["TestQuery1"],
		        "event": context,
		        "blocking": false
		    }));

		    inputs["TestQuery2"] = {};

		    promises.push(GQL_TestQuery2.fetch({
		        "variables": inputs["TestQuery2"],
		        "event": context,
		        "blocking": false
		    }));

		    const result = await Promise.all(promises);

		    return {
		        ...houdini_context.returnValue,
		        inputs: inputs
		    };
		}
	`)
	})

	test('compute variables', async function () {
		const route = await routeTest({
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

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const houdini_context = new request_context(context);
		    const inputs = {};
		    const promises = [];

		    inputs["TestQuery"] = houdini_context.computeInput({
		        "config": houdiniConfig,
		        "framework": "kit",
		        "variableFunction": TestQueryVariables,
		        "artifact": GQL_TestQuery["artifact"]
		    });

		    promises.push(GQL_TestQuery.fetch({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": false
		    }));

		    const result = await Promise.all(promises);

		    return {
		        ...houdini_context.returnValue,
		        inputs: inputs
		    };
		}
	`)
	})

	test('bare svelte component in route filepath', async function () {
		const route = await routeTest({
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

			const {
			    data
			} = query(GQL_TestQuery);
		`)
		expect(route.script).toMatchInlineSnapshot(``)
	})

	test('route with page stores', async function () {
		const route = await routeTest({
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
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";

		const {
		    data
		} = query(GQL_TestQuery);
	`)
		expect(route.script).toMatchInlineSnapshot(`
		import { GQL_MyQuery2 } from "$houdini/stores/MyQuery2";
		import { GQL_MyQuery1 } from "$houdini/stores/MyQuery1";
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";
		const store1 = GQL_MyQuery1;
		const store2 = GQL_MyQuery2;
		export function MyQuery2Variables() {}
		export const houdini_load = [store1, store2];

		export async function load(context) {
		    const houdini_context = new request_context(context);
		    const inputs = {};
		    const promises = [];
		    inputs["TestQuery"] = {};

		    promises.push(GQL_TestQuery.fetch({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": false
		    }));

		    inputs["MyQuery1"] = {};

		    promises.push(houdini_load[0].fetch({
		        "variables": inputs["MyQuery1"],
		        "event": context,
		        "blocking": false
		    }));

		    inputs["MyQuery2"] = houdini_context.computeInput({
		        "config": houdiniConfig,
		        "framework": "kit",
		        "variableFunction": MyQuery2Variables,
		        "artifact": houdini_load[1]["artifact"]
		    });

		    promises.push(houdini_load[1].fetch({
		        "variables": inputs["MyQuery2"],
		        "event": context,
		        "blocking": false
		    }));

		    const result = await Promise.all(promises);

		    return {
		        ...houdini_context.returnValue,
		        inputs: inputs
		    };
		}
	`)
	})

	test('route with page query', async function () {
		const route = await routeTest({
			query: `
				query TestQuery {
					viewer {
						id
					}
				}
			`,
		})

		expect(route.component).toMatchInlineSnapshot(``)
		expect(route.script).toMatchInlineSnapshot(`
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";

		export async function load(context) {
		    const houdini_context = new request_context(context);
		    const inputs = {};
		    const promises = [];
		    inputs["TestQuery"] = {};

		    promises.push(GQL_TestQuery.fetch({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": false
		    }));

		    const result = await Promise.all(promises);

		    return {
		        ...houdini_context.returnValue,
		        inputs: inputs
		    };
		}
	`)
	})

	test.todo('fails if variable function is not present')

	test.todo('adds arguments to an empty preload')
})

test('beforeLoad hook', async function () {
	const route = await routeTest({
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

		export async function beforeLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const houdini_context = new request_context(context);
		    const inputs = {};
		    const promises = [];

		    inputs["TestQuery"] = houdini_context.computeInput({
		        "config": houdiniConfig,
		        "framework": "kit",
		        "variableFunction": TestQueryVariables,
		        "artifact": GQL_TestQuery["artifact"]
		    });

		    promises.push(GQL_TestQuery.fetch({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": false
		    }));

		    const result = await Promise.all(promises);

		    await houdini_context.invokeLoadHook({
		        "variant": "before",
		        "framework": "kit",
		        "hookFn": beforeLoad
		    });

		    return {
		        ...houdini_context.returnValue,
		        inputs: inputs
		    };
		}
	`)
})

test('beforeLoad hook - multiple queries', async function () {
	const route = await routeTest({
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
		import { GQL_TestQuery1 } from "$houdini/stores/TestQuery1";

		export async function beforeLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const houdini_context = new request_context(context);
		    const inputs = {};
		    const promises = [];
		    inputs["TestQuery1"] = {};

		    promises.push(GQL_TestQuery1.fetch({
		        "variables": inputs["TestQuery1"],
		        "event": context,
		        "blocking": false
		    }));

		    inputs["TestQuery2"] = {};

		    promises.push(GQL_TestQuery2.fetch({
		        "variables": inputs["TestQuery2"],
		        "event": context,
		        "blocking": false
		    }));

		    const result = await Promise.all(promises);

		    await houdini_context.invokeLoadHook({
		        "variant": "before",
		        "framework": "kit",
		        "hookFn": beforeLoad
		    });

		    return {
		        ...houdini_context.returnValue,
		        inputs: inputs
		    };
		}
	`)
})

test('afterLoad hook', async function () {
	const route = await routeTest({
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

		export async function afterLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const houdini_context = new request_context(context);
		    const inputs = {};
		    const promises = [];

		    inputs["TestQuery"] = houdini_context.computeInput({
		        "config": houdiniConfig,
		        "framework": "kit",
		        "variableFunction": TestQueryVariables,
		        "artifact": GQL_TestQuery["artifact"]
		    });

		    promises.push(GQL_TestQuery.fetch({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": true
		    }));

		    const result = await Promise.all(promises);

		    await houdini_context.invokeLoadHook({
		        "variant": "after",
		        "framework": "kit",
		        "hookFn": afterLoad,
		        "input": inputs,

		        "data": {
		            "TestQuery": result[0]
		        }
		    });

		    return {
		        ...houdini_context.returnValue,
		        inputs: inputs
		    };
		}
	`)
})

test('afterLoad hook - multiple queries', async function () {
	const route = await routeTest({
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
		import { GQL_TestQuery1 } from "$houdini/stores/TestQuery1";

		export async function afterLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
		    };
		}

		export async function load(context) {
		    const houdini_context = new request_context(context);
		    const inputs = {};
		    const promises = [];
		    inputs["TestQuery1"] = {};

		    promises.push(GQL_TestQuery1.fetch({
		        "variables": inputs["TestQuery1"],
		        "event": context,
		        "blocking": true
		    }));

		    inputs["TestQuery2"] = {};

		    promises.push(GQL_TestQuery2.fetch({
		        "variables": inputs["TestQuery2"],
		        "event": context,
		        "blocking": true
		    }));

		    const result = await Promise.all(promises);

		    await houdini_context.invokeLoadHook({
		        "variant": "after",
		        "framework": "kit",
		        "hookFn": afterLoad,
		        "input": inputs,

		        "data": {
		            "TestQuery1": result[0],
		            "TestQuery2": result[1]
		        }
		    });

		    return {
		        ...houdini_context.returnValue,
		        inputs: inputs
		    };
		}
	`)
})

test('both beforeLoad and afterLoad hooks', async function () {
	const route = await routeTest({
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
		    const houdini_context = new request_context(context);
		    const inputs = {};
		    const promises = [];

		    inputs["TestQuery"] = houdini_context.computeInput({
		        "config": houdiniConfig,
		        "framework": "kit",
		        "variableFunction": TestQueryVariables,
		        "artifact": GQL_TestQuery["artifact"]
		    });

		    promises.push(GQL_TestQuery.fetch({
		        "variables": inputs["TestQuery"],
		        "event": context,
		        "blocking": true
		    }));

		    const result = await Promise.all(promises);

		    await houdini_context.invokeLoadHook({
		        "variant": "before",
		        "framework": "kit",
		        "hookFn": beforeLoad
		    });

		    await houdini_context.invokeLoadHook({
		        "variant": "after",
		        "framework": "kit",
		        "hookFn": afterLoad,
		        "input": inputs,

		        "data": {
		            "TestQuery": result[0]
		        }
		    });

		    return {
		        ...houdini_context.returnValue,
		        inputs: inputs
		    };
		}
	`)
})
