// test('non-route page - no variables', async function () {
// 	const route = await preprocessorTest(
// 		`
// 			<script>
// 				const { data } = query(graphql\`
// 					query TestQuery {
// 						viewer {
// 							id
// 						}
// 					}
// 				\`)
// 			</script>
// 		`,
// 		{
// 			route: false,
// 		}
// 	)

// 	// make sure we added the right stuff
// 	expect(doc).toMatchInlineSnapshot(`
// 		import { isBrowser } from "$houdini/runtime/adapter";
// 		import { getHoudiniContext } from "$houdini/runtime/lib/context";
// 		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
// 		import { TestQueryStore } from "$houdini/stores/TestQuery";
// 		const store_TestQueryStore = TestQueryStore();
// 		const _houdini_context_generated_DONT_USE = getHoudiniContext();

// 		const {
// 		    data
// 		} = query({
// 		    kind: "HoudiniQuery",
// 		    store: store_TestQueryStore,
// 		    config: houdiniConfig,
// 		    artifact: _TestQueryArtifact
// 		});

// 		let _TestQuery_Input = {};

// 		$:
// 		isBrowser && store_TestQueryStore.fetch({
// 		    "variables": _TestQuery_Input,
// 		    "context": _houdini_context_generated_DONT_USE
// 		});
// 	`)
// })

// test('non-route page - with variables', async function () {
// 	const route = await preprocessorTest(
// 		`
// 			<script context="module">
// 				export function TestQueryVariables() {
// 					return {
// 						hello: 'world'
// 					}
// 				}
// 			</script>

// 			<script>
// 				export let prop1 = 'hello'
// 				export const prop2 = 'goodbye'
// 				export let prop3, prop4

// 				const { data } = query(graphql\`
// 					query TestQuery($test: String!) {
// 						users(stringValue: $test) {
// 							id
// 						}
// 					}
// 				\`)
// 			</script>
// 		`,
// 		{
// 			route: false,
// 		}
// 	)

// 	// make sure we added the right stuff
// 	expect(doc).toMatchInlineSnapshot(`
// 		import { houdiniConfig } from "$houdini";

// 		export function TestQueryVariables() {
// 		    return {
// 		        hello: "world"
// 		    };
// 		}
// 	`)
// })

// test('2 queries, one paginated one not', async function () {
// 	const route = await routeTest(
// 		{
// 			component: `

// 			const { data } = query(graphql\`
// 				query TestQuery1($test: Boolean!) {
// 					viewer {
// 						id
// 					}
// 				}
// 			\`)

// 			const { data: data2 } = paginatedQuery(graphql\`
// 				query TestQuery2($test: Boolean!) {
// 					viewer {
// 						id
// 					}
// 				}
// 			\`)
// 			`,
// 		}`
// 		<script>
// 		</script>
// 	`
// 	)

// 	expect(route.component).toMatchInlineSnapshot()
// })
