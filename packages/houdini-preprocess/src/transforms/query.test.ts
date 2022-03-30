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

		    const _TestQuery = await fetchQuery({
		        "context": context,
		        "artifact": _TestQueryArtifact,
		        "variables": _TestQuery_Input,
		        "session": context.session
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    return {
		        props: {
		            _TestQuery: {
		                ..._TestQuery,
		                variables: _TestQuery_Input
		            }
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
		    variableFunction: null,
		    getProps: () => $$props
		});

		$:
		{
		    _TestQuery_handler.onLoad(_TestQuery);
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
		import { fetchQuery, RequestContext } from "$houdini";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
		import { houdiniConfig } from "$houdini";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery2_Input = {};

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery2 = await fetchQuery({
		        "context": context,
		        "artifact": _TestQuery2Artifact,
		        "variables": _TestQuery2_Input,
		        "session": context.session
		    });

		    if (!_TestQuery2.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery2);
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery1_Input = {};

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery1 = await fetchQuery({
		        "context": context,
		        "artifact": _TestQuery1Artifact,
		        "variables": _TestQuery1_Input,
		        "session": context.session
		    });

		    if (!_TestQuery1.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery1);
		        return _houdini_context.returnValue;
		    }

		    return {
		        props: {
		            _TestQuery1: {
		                ..._TestQuery1,
		                variables: _TestQuery1_Input
		            },

		            _TestQuery2: {
		                ..._TestQuery2,
		                variables: _TestQuery2_Input
		            }
		        }
		    };
		}

		export function preload(page, session) {
		    return convertKitPayload(this, load, page, session);
		}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		export let _TestQuery2 = undefined;

		let _TestQuery2_handler = query({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery2.result,
		    "variables": _TestQuery2.variables,
		    "partial": _TestQuery2.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQuery2Artifact,
		    "source": _TestQuery2.source
		});

		export let _TestQuery1 = undefined;

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
		    variableFunction: null,
		    getProps: () => $$props
		});

		const {
		    data: data2
		} = routeQuery({
		    queryHandler: _TestQuery2_handler,
		    config: houdiniConfig,
		    artifact: _TestQuery2Artifact,
		    variableFunction: null,
		    getProps: () => $$props
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

		    const _TestQuery = await fetchQuery({
		        "context": context,
		        "artifact": _TestQueryArtifact,
		        "variables": _TestQuery_Input,
		        "session": context.session
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    return {
		        props: {
		            _TestQuery: {
		                ..._TestQuery,
		                variables: _TestQuery_Input
		            }
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
		    variableFunction: TestQueryVariables,
		    getProps: () => $$props
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
		import { fetchQuery, RequestContext } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { houdiniConfig } from "$houdini";

		export async function load(context) {
		    const _houdini_context = new RequestContext(context);
		    const _TestQuery_Input = {};

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery = await fetchQuery({
		        "context": context,
		        "artifact": _TestQueryArtifact,
		        "variables": _TestQuery_Input,
		        "session": context.session
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    return {
		        props: {
		            _TestQuery: {
		                ..._TestQuery,
		                variables: _TestQuery_Input
		            }
		        }
		    };
		}
	`)
		expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		export let _TestQuery = undefined;

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
		    variableFunction: null,
		    getProps: () => $$props
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
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		export let _TestQuery = undefined;

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
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		export let _TestQuery = undefined;

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
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		export let _TestQuery = undefined;

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
		export let _TestQuery = undefined;

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
		    variableFunction: TestQueryVariables,
		    getProps: () => $$props
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
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		export let _TestQuery = undefined;

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
		import { fetchQuery, RequestContext } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
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

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const beforeHookReturn = _houdini_context.returnValue;

		    const _TestQuery_Input = _houdini_context.computeInput({
		        "config": houdiniConfig,
		        "mode": "sapper",
		        "variableFunction": TestQueryVariables,
		        "artifact": _TestQueryArtifact
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery = await fetchQuery({
		        "context": context,
		        "artifact": _TestQueryArtifact,
		        "variables": _TestQuery_Input,
		        "session": context.session
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    if (beforeHookReturn.props || beforeHookReturn.stuff) {
		        return {
		            ...beforeHookReturn,

		            props: {
		                _TestQuery: {
		                    ..._TestQuery,
		                    variables: _TestQuery_Input
		                },

		                ...beforeHookReturn.props
		            }
		        };
		    }

		    return {
		        props: {
		            _TestQuery: {
		                ..._TestQuery,
		                variables: _TestQuery_Input
		            },

		            ...beforeHookReturn
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

	expect(doc.module?.content).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini";
		import { fetchQuery, RequestContext } from "$houdini";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
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

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const beforeHookReturn = _houdini_context.returnValue;
		    const _TestQuery2_Input = {};

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery2 = await fetchQuery({
		        "context": context,
		        "artifact": _TestQuery2Artifact,
		        "variables": _TestQuery2_Input,
		        "session": context.session
		    });

		    if (!_TestQuery2.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery2);
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery1_Input = {};

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery1 = await fetchQuery({
		        "context": context,
		        "artifact": _TestQuery1Artifact,
		        "variables": _TestQuery1_Input,
		        "session": context.session
		    });

		    if (!_TestQuery1.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery1);
		        return _houdini_context.returnValue;
		    }

		    if (beforeHookReturn.props || beforeHookReturn.stuff) {
		        return {
		            ...beforeHookReturn,

		            props: {
		                _TestQuery1: {
		                    ..._TestQuery1,
		                    variables: _TestQuery1_Input
		                },

		                _TestQuery2: {
		                    ..._TestQuery2,
		                    variables: _TestQuery2_Input
		                },

		                ...beforeHookReturn.props
		            }
		        };
		    }

		    return {
		        props: {
		            _TestQuery1: {
		                ..._TestQuery1,
		                variables: _TestQuery1_Input
		            },

		            _TestQuery2: {
		                ..._TestQuery2,
		                variables: _TestQuery2_Input
		            },

		            ...beforeHookReturn
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

	expect(doc.module?.content).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini";
		import { fetchQuery, RequestContext } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
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
		        "mode": "sapper",
		        "variableFunction": TestQueryVariables,
		        "artifact": _TestQueryArtifact
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery = await fetchQuery({
		        "context": context,
		        "artifact": _TestQueryArtifact,
		        "variables": _TestQuery_Input,
		        "session": context.session
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    await _houdini_context.invokeLoadHook({
		        "variant": "after",
		        "framework": "sapper",
		        "hookFn": afterLoad,

		        "data": {
		            "TestQuery": _TestQuery.data
		        }
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const afterHookReturn = _houdini_context.returnValue;

		    if (afterHookReturn.props || afterHookReturn.stuff) {
		        return {
		            ...afterHookReturn,

		            props: {
		                _TestQuery: {
		                    ..._TestQuery,
		                    variables: _TestQuery_Input
		                },

		                ...afterHookReturn.props
		            }
		        };
		    }

		    return {
		        props: {
		            _TestQuery: {
		                ..._TestQuery,
		                variables: _TestQuery_Input
		            },

		            ...afterHookReturn
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

	expect(doc.module?.content).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini";
		import { fetchQuery, RequestContext } from "$houdini";
		import _TestQuery2Artifact from "$houdini/artifacts/TestQuery2";
		import _TestQuery1Artifact from "$houdini/artifacts/TestQuery1";
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

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery2 = await fetchQuery({
		        "context": context,
		        "artifact": _TestQuery2Artifact,
		        "variables": _TestQuery2_Input,
		        "session": context.session
		    });

		    if (!_TestQuery2.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery2);
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery1_Input = {};

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery1 = await fetchQuery({
		        "context": context,
		        "artifact": _TestQuery1Artifact,
		        "variables": _TestQuery1_Input,
		        "session": context.session
		    });

		    if (!_TestQuery1.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery1);
		        return _houdini_context.returnValue;
		    }

		    await _houdini_context.invokeLoadHook({
		        "variant": "after",
		        "framework": "sapper",
		        "hookFn": afterLoad,

		        "data": {
		            "TestQuery1": _TestQuery1.data,
		            "TestQuery2": _TestQuery2.data
		        }
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const afterHookReturn = _houdini_context.returnValue;

		    if (afterHookReturn.props || afterHookReturn.stuff) {
		        return {
		            ...afterHookReturn,

		            props: {
		                _TestQuery1: {
		                    ..._TestQuery1,
		                    variables: _TestQuery1_Input
		                },

		                _TestQuery2: {
		                    ..._TestQuery2,
		                    variables: _TestQuery2_Input
		                },

		                ...afterHookReturn.props
		            }
		        };
		    }

		    return {
		        props: {
		            _TestQuery1: {
		                ..._TestQuery1,
		                variables: _TestQuery1_Input
		            },

		            _TestQuery2: {
		                ..._TestQuery2,
		                variables: _TestQuery2_Input
		            },

		            ...afterHookReturn
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

	expect(doc.module?.content).toMatchInlineSnapshot(`
		import { convertKitPayload } from "$houdini";
		import { fetchQuery, RequestContext } from "$houdini";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
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

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const beforeHookReturn = _houdini_context.returnValue;

		    const _TestQuery_Input = _houdini_context.computeInput({
		        "config": houdiniConfig,
		        "mode": "sapper",
		        "variableFunction": TestQueryVariables,
		        "artifact": _TestQueryArtifact
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery = await fetchQuery({
		        "context": context,
		        "artifact": _TestQueryArtifact,
		        "variables": _TestQuery_Input,
		        "session": context.session
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    await _houdini_context.invokeLoadHook({
		        "variant": "after",
		        "framework": "sapper",
		        "hookFn": afterLoad,

		        "data": {
		            "TestQuery": _TestQuery.data
		        }
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const afterHookReturn = _houdini_context.returnValue;

		    const hookReturn = {
		        ...beforeHookReturn,
		        ...afterHookReturn
		    };

		    if (hookReturn.props) {
		        hookReturn.props = {
		            ...beforeHookReturn.props,
		            ...afterHookReturn.props
		        };
		    }

		    if (hookReturn.stuff) {
		        hookReturn.stuff = {
		            ...beforeHookReturn.stuff,
		            ...afterHookReturn.stuff
		        };
		    }

		    if (hookReturn.props || hookReturn.stuff) {
		        return {
		            ...hookReturn,

		            props: {
		                _TestQuery: {
		                    ..._TestQuery,
		                    variables: _TestQuery_Input
		                },

		                ...hookReturn.props
		            }
		        };
		    }

		    return {
		        props: {
		            _TestQuery: {
		                ..._TestQuery,
		                variables: _TestQuery_Input
		            },

		            ...hookReturn
		        }
		    };
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

		    await _houdini_context.invokeLoadHook({
		        "variant": "before",
		        "framework": "sapper",
		        "hookFn": onLoad
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const beforeHookReturn = _houdini_context.returnValue;

		    const _TestQuery_Input = _houdini_context.computeInput({
		        "config": houdiniConfig,
		        "mode": "sapper",
		        "variableFunction": TestQueryVariables,
		        "artifact": _TestQueryArtifact
		    });

		    if (!_houdini_context.continue) {
		        return _houdini_context.returnValue;
		    }

		    const _TestQuery = await fetchQuery({
		        "context": context,
		        "artifact": _TestQueryArtifact,
		        "variables": _TestQuery_Input,
		        "session": context.session
		    });

		    if (!_TestQuery.result.data) {
		        _houdini_context.graphqlErrors(_TestQuery);
		        return _houdini_context.returnValue;
		    }

		    if (beforeHookReturn.props || beforeHookReturn.stuff) {
		        return {
		            ...beforeHookReturn,

		            props: {
		                _TestQuery: {
		                    ..._TestQuery,
		                    variables: _TestQuery_Input
		                },

		                ...beforeHookReturn.props
		            }
		        };
		    }

		    return {
		        props: {
		            _TestQuery: {
		                ..._TestQuery,
		                variables: _TestQuery_Input
		            },

		            ...beforeHookReturn
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
	`
	)

	expect(doc.instance?.content).toMatchInlineSnapshot(`
		import { routeQuery, componentQuery, query } from "$houdini";
		export let _TestQuery2 = undefined;

		let _TestQuery2_handler = paginatedQuery({
		    "config": houdiniConfig,
		    "initialValue": _TestQuery2.result,
		    "variables": _TestQuery2.variables,
		    "partial": _TestQuery2.partial,
		    "kind": "HoudiniQuery",
		    "artifact": _TestQuery2Artifact,
		    "source": _TestQuery2.source
		});

		export let _TestQuery1 = undefined;

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
		    variableFunction: TestQuery1Variables,
		    getProps: () => $$props
		});

		const {
		    data: data2
		} = routeQuery({
		    queryHandler: _TestQuery2_handler,
		    config: houdiniConfig,
		    artifact: _TestQuery2Artifact,
		    variableFunction: TestQuery2Variables,
		    getProps: () => $$props
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
