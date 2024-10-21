import { test, expect, vi, describe } from 'vitest'

import { component_test } from '../../test'

test('no variables', async function () {
	const route = await component_test(
		`
            $: value = graphql\`
                query TestQuery @load {
                    viewer {
                        id
                    }
                }
            \`
		`
	)

	// make sure we added the right stuff
	expect(route).toMatchInlineSnapshot(`
		import { TestQueryStore } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
		import { isBrowser } from "$houdini/plugins/houdini-svelte/runtime/adapter";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { marshalInputs } from "$houdini/runtime/lib/scalars";
		const _houdini_TestQuery = new TestQueryStore();

		$:
		value = _houdini_TestQuery;

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

test('with variables', async function () {
	const route = await component_test(
		`
            export function _TestQueryVariables() {
                return {
                    hello: 'world'
                }
            }

            export let prop1 = 'hello'
            export const prop2 = 'goodbye'
            export let prop3, prop4

            $: result = graphql\`
                query TestQuery($test: String!) @load {
                    users(stringValue: $test) {
                        id
                    }
                }
            \`
		`
	)

	// make sure we added the right stuff
	expect(route).toMatchInlineSnapshot(`
		import { TestQueryStore } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
		import { isBrowser } from "$houdini/plugins/houdini-svelte/runtime/adapter";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { marshalInputs } from "$houdini/runtime/lib/scalars";
		const _houdini_TestQuery = new TestQueryStore();

		export function _TestQueryVariables() {
		    return {
		        hello: "world"
		    };
		}

		export let prop1 = "hello";
		export const prop2 = "goodbye";
		export let prop3, prop4;

		$:
		result = _houdini_TestQuery;

		$:
		isBrowser && _houdini_TestQuery.fetch({
		    variables: marshalInputs({
		        config: getCurrentConfig(),
		        artifact: _houdini_TestQuery.artifact,

		        input: _TestQueryVariables.call(new RequestContext(), {
		            props: {
		                prop1: prop1,
		                prop2: prop2,
		                prop3: prop3,
		                prop4: prop4
		            }
		        })
		    })
		});
	`)
})

test('graphql function', async function () {
	const route = await component_test(
		`
            export function _TestQueryVariables() {
                return {
                    hello: 'world'
                }
            }

            export let prop1 = 'hello'
            export const prop2 = 'goodbye'
            export let prop3, prop4

            $: result = graphql(\`
                query TestQuery($test: String!) @load {
                    users(stringValue: $test) {
                        id
                    }
                }
            \`)
		`
	)

	// make sure we added the right stuff
	expect(route).toMatchInlineSnapshot(`
		import { TestQueryStore } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
		import { isBrowser } from "$houdini/plugins/houdini-svelte/runtime/adapter";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { getCurrentConfig } from "$houdini/runtime/lib/config";
		import { marshalInputs } from "$houdini/runtime/lib/scalars";
		const _houdini_TestQuery = new TestQueryStore();

		export function _TestQueryVariables() {
		    return {
		        hello: "world"
		    };
		}

		export let prop1 = "hello";
		export const prop2 = "goodbye";
		export let prop3, prop4;

		$:
		result = _houdini_TestQuery;

		$:
		isBrowser && _houdini_TestQuery.fetch({
		    variables: marshalInputs({
		        config: getCurrentConfig(),
		        artifact: _houdini_TestQuery.artifact,

		        input: _TestQueryVariables.call(new RequestContext(), {
		            props: {
		                prop1: prop1,
		                prop2: prop2,
		                prop3: prop3,
		                prop4: prop4
		            }
		        })
		    })
		});
	`)
})

test("imperative cache doesn't confuse the load generator", async function () {
	const route = await component_test(
		`
			import { cache } from '$houdini'

			cache.read({
				query: graphql(\`
					query TestQuery($test: String!) {
						users(stringValue: $test) {
							id
						}
					}
				\`)
			})
		`
	)

	// make sure we added the right stuff
	expect(route).toMatchInlineSnapshot(`
		import { TestQueryStore } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
		import { cache } from "$houdini";

		cache.read({
		    query: new TestQueryStore()
		});
	`)
})

test("imperative cache inside mutation doesn't confuse anything", async function () {
	const route = await component_test(
		`
			import { cache } from '$houdini'

			function onClick() {
				const query = graphql(\`
					query TestQuery($test: String!) {
						users(stringValue: $test) {
							id
						}
					}
				\`)

				cache.read({
					query
				})
			}
		`
	)

	// make sure we added the right stuff
	expect(route).toMatchInlineSnapshot(`
		import { TestQueryStore } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
		import { cache } from "$houdini";

		function onClick() {
		    const query = new TestQueryStore();

		    cache.read({
		        query
		    });
		}
	`)
})

test('missing variables', async function () {
	vi.spyOn(console, 'error')

	await component_test(
		`
            export let prop1 = 'hello'
            export const prop2 = 'goodbye'
            export let prop3, prop4

            $: result = graphql\`
                query TestQuery($test: String!) @load {
                    users(stringValue: $test) {
                        id
                    }
                }
            \`
		`
	)
	expect(console.error).toHaveBeenCalled()
	// @ts-ignore
	expect(console.error.mock.calls).toMatchInlineSnapshot(
		`
		[
		    [
		        "❌ Encountered error in src/lib/component.svelte"
		    ],
		    [
		        "Could not find required variable function: \\u001b[33m_TestQueryVariables\\u001b[39m. maybe its not exported? "
		    ]
		]
	`
	)
})

describe('Svelte 5 runes', function () {
	test('no variables', async function () {
		const route = await component_test(
			`
				let value = $derived(
					graphql(\`
						query TestQuery @load {
							viewer {
								id
							}
						}
					\`)
				)
			`
		)

		expect(route).toMatchInlineSnapshot(`
			import { TestQueryStore } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
			import { isBrowser } from "$houdini/plugins/houdini-svelte/runtime/adapter";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { marshalInputs } from "$houdini/runtime/lib/scalars";
			const _houdini_TestQuery = new TestQueryStore();
			let value = $derived(_houdini_TestQuery);

			$effect(() => {
			    _houdini_TestQuery.fetch({
			        variables: marshalInputs({
			            config: getCurrentConfig(),
			            artifact: _houdini_TestQuery.artifact,
			            input: {}
			        })
			    });
			});
		`)
	})

	test('with variables', async function () {
		const route = await component_test(
			`
				export function _TestQueryVariables() {
					return {
						hello: 'world'
					}
				}
	
				const { prop1, prop2, prop3, prop4 } = $props();
	
				const result = $derived(
					graphql\`
						query TestQuery($test: String!) @load {
							users(stringValue: $test) {
								id
							}
						}
					\`
				)
			`
		)

		// make sure we added the right stuff
		expect(route).toMatchInlineSnapshot(`
			import { TestQueryStore } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
			import { isBrowser } from "$houdini/plugins/houdini-svelte/runtime/adapter";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { marshalInputs } from "$houdini/runtime/lib/scalars";
			const _houdini_TestQuery = new TestQueryStore();

			export function _TestQueryVariables() {
			    return {
			        hello: "world"
			    };
			}

			const {
			    prop1,
			    prop2,
			    prop3,
			    prop4
			} = $props();

			const result = $derived(_houdini_TestQuery);

			$effect(() => {
			    _houdini_TestQuery.fetch({
			        variables: marshalInputs({
			            config: getCurrentConfig(),
			            artifact: _houdini_TestQuery.artifact,

			            input: _TestQueryVariables.call(new RequestContext(), {
			                props: {
			                    prop1: prop1,
			                    prop2: prop2,
			                    prop3: prop3,
			                    prop4: prop4
			                }
			            })
			        })
			    });
			});
		`)
	})

	test('force Runes mode enabled', async function () {
		const route = await component_test(
			`
				const store = graphql(\`
					query TestQuery($test: String!) @load {
						users(stringValue: $test) {
							id
						}
					}
				\`)
			`,
			{
				plugins: {
					'houdini-plugin-svelte-global-stores': {},
					'houdini-svelte': {
						framework: 'kit',
						forceRunesMode: true,
					},
				},
			}
		)

		expect(route).toMatchInlineSnapshot(`
			import { TestQueryStore } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
			import { isBrowser } from "$houdini/plugins/houdini-svelte/runtime/adapter";
			import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
			import { getCurrentConfig } from "$houdini/runtime/lib/config";
			import { marshalInputs } from "$houdini/runtime/lib/scalars";
			const _houdini_TestQuery = new TestQueryStore();
			const store = _houdini_TestQuery;

			$effect(() => {
			    _houdini_TestQuery.fetch({
			        variables: marshalInputs({
			            config: getCurrentConfig(),
			            artifact: _houdini_TestQuery.artifact,
			            input: {}
			        })
			    });
			});
		`)
	})
})
