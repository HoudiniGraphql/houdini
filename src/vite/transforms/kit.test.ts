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
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";

		export async function load(context) {
		    const houdini_context = new request_context(context);
		    const TestQuery_Input = {};

		    const TestQuery = await GQL_TestQuery.fetch({
		        "variables": TestQuery_Input,
		        "event": context,
		        "blocking": false
		    });

		    return {
		        ...houdini_context.returnValue,

		        props: {
		            ...houdini_context.returnValue.props,
		            TestQuery_Input: TestQuery_Input
		        }
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
			import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
			import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
			import { GQL_TestQuery2 } from "$houdini/stores/TestQuery2";
			import { GQL_TestQuery1 } from "$houdini/stores/TestQuery1";

			export async function load(context) {
			    const houdini_context = new request_context(context);
			    const TestQuery2_Input = {};

			    const TestQuery2Promise = GQL_TestQuery2.fetch({
			        "variables": TestQuery2_Input,
			        "event": context,
			        "blocking": false
			    });

			    const TestQuery1_Input = {};

			    const TestQuery1Promise = GQL_TestQuery1.fetch({
			        "variables": TestQuery1_Input,
			        "event": context,
			        "blocking": false
			    });

			    const TestQuery2 = await TestQuery2Promise;
			    const TestQuery1 = await TestQuery1Promise;

			    return {
			        ...houdini_context.returnValue,

			        props: {
			            ...houdini_context.returnValue.props,
			            TestQuery1_Input: TestQuery1_Input,
			            TestQuery2_Input: TestQuery2_Input
			        }
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
			import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
			import { GQL_TestQuery } from "$houdini/stores/TestQuery";

			export function TestQueryVariables(page) {
			    return {
			        test: true
			    };
			}

			export async function load(context) {
			    const houdini_context = new request_context(context);

			    const TestQuery_Input = houdini_context.computeInput({
			        "config": houdiniConfig,
			        "framework": "kit",
			        "variableFunction": TestQueryVariables,
			        "artifact": _TestQueryArtifact
			    });

			    if (!houdini_context.continue) {
			        return houdini_context.returnValue;
			    }

			    const TestQuery = await GQL_TestQuery.fetch({
			        "variables": TestQuery_Input,
			        "event": context,
			        "blocking": false
			    });

			    return {
			        ...houdini_context.returnValue,

			        props: {
			            ...houdini_context.returnValue.props,
			            TestQuery_Input: TestQuery_Input
			        }
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
			import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
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

			    await houdini_context.invokeLoadHook({
			        "variant": "before",
			        "framework": "kit",
			        "hookFn": beforeLoad
			    });

			    const TestQuery_Input = houdini_context.computeInput({
			        "config": houdiniConfig,
			        "framework": "kit",
			        "variableFunction": TestQueryVariables,
			        "artifact": _TestQueryArtifact
			    });

			    if (!houdini_context.continue) {
			        return houdini_context.returnValue;
			    }

			    const TestQuery = await GQL_TestQuery.fetch({
			        "variables": TestQuery_Input,
			        "event": context,
			        "blocking": false
			    });

			    return {
			        ...houdini_context.returnValue,

			        props: {
			            ...houdini_context.returnValue.props,
			            TestQuery_Input: TestQuery_Input
			        }
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
			import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
			import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
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

			    await houdini_context.invokeLoadHook({
			        "variant": "before",
			        "framework": "kit",
			        "hookFn": beforeLoad
			    });

			    const TestQuery2_Input = {};

			    const TestQuery2Promise = GQL_TestQuery2.fetch({
			        "variables": TestQuery2_Input,
			        "event": context,
			        "blocking": false
			    });

			    const TestQuery1_Input = {};

			    const TestQuery1Promise = GQL_TestQuery1.fetch({
			        "variables": TestQuery1_Input,
			        "event": context,
			        "blocking": false
			    });

			    const TestQuery2 = await TestQuery2Promise;
			    const TestQuery1 = await TestQuery1Promise;

			    return {
			        ...houdini_context.returnValue,

			        props: {
			            ...houdini_context.returnValue.props,
			            TestQuery1_Input: TestQuery1_Input,
			            TestQuery2_Input: TestQuery2_Input
			        }
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
			import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
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

			    const TestQuery_Input = houdini_context.computeInput({
			        "config": houdiniConfig,
			        "framework": "kit",
			        "variableFunction": TestQueryVariables,
			        "artifact": _TestQueryArtifact
			    });

			    if (!houdini_context.continue) {
			        return houdini_context.returnValue;
			    }

			    const TestQuery = await GQL_TestQuery.fetch({
			        "variables": TestQuery_Input,
			        "event": context,
			        "blocking": true
			    });

			    await houdini_context.invokeLoadHook({
			        "variant": "after",
			        "framework": "kit",
			        "hookFn": afterLoad,

			        "input": {
			            "TestQuery": TestQuery_Input
			        },

			        "data": {
			            "TestQuery": TestQuery.data
			        }
			    });

			    return {
			        ...houdini_context.returnValue,

			        props: {
			            ...houdini_context.returnValue.props,
			            TestQuery_Input: TestQuery_Input
			        }
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
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
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
		    const TestQuery2_Input = {};

		    const TestQuery2Promise = GQL_TestQuery2.fetch({
		        "variables": TestQuery2_Input,
		        "event": context,
		        "blocking": true
		    });

		    const TestQuery1_Input = {};

		    const TestQuery1Promise = GQL_TestQuery1.fetch({
		        "variables": TestQuery1_Input,
		        "event": context,
		        "blocking": true
		    });

		    const TestQuery2 = await TestQuery2Promise;
		    const TestQuery1 = await TestQuery1Promise;

		    await houdini_context.invokeLoadHook({
		        "variant": "after",
		        "framework": "kit",
		        "hookFn": afterLoad,

		        "input": {
		            "TestQuery1": TestQuery1_Input,
		            "TestQuery2": TestQuery2_Input
		        },

		        "data": {
		            "TestQuery1": TestQuery1.data,
		            "TestQuery2": TestQuery2.data
		        }
		    });

		    return {
		        ...houdini_context.returnValue,

		        props: {
		            ...houdini_context.returnValue.props,
		            TestQuery1_Input: TestQuery1_Input,
		            TestQuery2_Input: TestQuery2_Input
		        }
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
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
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

		    await houdini_context.invokeLoadHook({
		        "variant": "before",
		        "framework": "kit",
		        "hookFn": beforeLoad
		    });

		    const TestQuery_Input = houdini_context.computeInput({
		        "config": houdiniConfig,
		        "framework": "kit",
		        "variableFunction": TestQueryVariables,
		        "artifact": _TestQueryArtifact
		    });

		    if (!houdini_context.continue) {
		        return houdini_context.returnValue;
		    }

		    const TestQuery = await GQL_TestQuery.fetch({
		        "variables": TestQuery_Input,
		        "event": context,
		        "blocking": true
		    });

		    await houdini_context.invokeLoadHook({
		        "variant": "after",
		        "framework": "kit",
		        "hookFn": afterLoad,

		        "input": {
		            "TestQuery": TestQuery_Input
		        },

		        "data": {
		            "TestQuery": TestQuery.data
		        }
		    });

		    return {
		        ...houdini_context.returnValue,

		        props: {
		            ...houdini_context.returnValue.props,
		            TestQuery_Input: TestQuery_Input
		        }
		    };
		}
	`)
})
