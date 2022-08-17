import { test, expect, describe } from 'vitest'

import { graphql } from '../../runtime'
import { route_test } from '../tests'

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
		import { injectContext } from "$houdini/runtime/lib/context";
		import GQL_TestQuery from "$houdini/stores/TestQuery";
		injectContext([GQL_TestQuery]);
		const store = GQL_TestQuery;
	`)
	})

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
			import { injectContext } from "$houdini/runtime/lib/context";
			import GQL_TestQuery from "$houdini/stores/TestQuery";
			injectContext([GQL_TestQuery]);

			const {
			    data
			} = query(GQL_TestQuery);
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
		expect(route.script).toMatchInlineSnapshot('export async function load() {}')
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
			import { injectContext } from "$houdini/runtime/lib/context";
			import GQL_TestQuery2 from "$houdini/stores/TestQuery2";
			import GQL_TestQuery1 from "$houdini/stores/TestQuery1";
			injectContext([GQL_TestQuery2, GQL_TestQuery1]);

			const {
			    data: data1
			} = query(GQL_TestQuery1);

			const {
			    data: data2
			} = query(GQL_TestQuery2);
		`)
		expect(route.script).toMatchInlineSnapshot('')
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
			export function TestQueryVariables(page) {
			    return {
			        test: true
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
		import { TestQueryStore } from "$houdini/stores/TestQuery";
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";
		const _houdini_TestQuery = TestQueryStore();

		const {
		    data
		} = query(_houdini_TestQuery);

		const _houdini_context_DO_NOT_USE = getHoudiniContext();

		$:
		_TestQuery_Input = {};

		$:
		isBrowser && _houdini_TestQuery.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: _TestQuery_Input
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
			query MyQuery2($input: Int) {
				field(input: $input)
			}
		`

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
			import { injectContext } from "$houdini/runtime/lib/context";
			import GQL_TestQuery from "$houdini/stores/TestQuery";
			injectContext([GQL_TestQuery]);

			const {
			    data
			} = query(GQL_TestQuery);
		`)
		expect(route.script).toMatchInlineSnapshot(`
			import GQL_MyQuery2 from "$houdini/stores/MyQuery2";
			import GQL_MyQuery1 from "$houdini/stores/MyQuery1";
			const store1 = GQL_MyQuery1;
			const store2 = GQL_MyQuery2;
			export function MyQuery2Variables() {}
			export const houdini_load = [store1, store2];
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

		expect(route.component).toMatchInlineSnapshot('')
		expect(route.script).toMatchInlineSnapshot('')
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
		export async function beforeLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
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
		export async function beforeLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
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
		export async function afterLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
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
		export async function afterLoad() {
		    return this.redirect(302, "/test");
		}

		export function TestQueryVariables(page) {
		    return {
		        test: true
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
	`)
})
