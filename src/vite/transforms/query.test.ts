import '../../../jest.setup'
import { component_test } from '../tests'

test('no variables', async function () {
	const route = await component_test(
		`
            const { data } = query(graphql\`
                query TestQuery {
                    viewer {
                        id
                    }
                }
            \`)
		`
	)

	// make sure we added the right stuff
	expect(route).toMatchInlineSnapshot(`
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";

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

test('with variables', async function () {
	const route = await component_test(
		`
            export function TestQueryVariables() {
                return {
                    hello: 'world'
                }
            }
            
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
		`
	)

	// make sure we added the right stuff
	expect(route).toMatchInlineSnapshot(`
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";
		import _TestQueryArtifact from "$houdini/artifacts/TestQuery";
		import { GQL_TestQuery } from "$houdini/stores/TestQuery";

		export function TestQueryVariables() {
		    return {
		        hello: "world"
		    };
		}

		export let prop1 = "hello";
		export const prop2 = "goodbye";
		export let prop3, prop4;

		const {
		    data
		} = query(GQL_TestQuery);

		const _houdini_context_DO_NOT_USE = getHoudiniContext();

		$:
		_TestQuery_Input = marshalInputs({
		    config: houdiniConfig,
		    artifact: _,

		    input: TestQueryVariables.call(_houdini_context_DO_NOT_USE, {
		        props: {
		            prop1: prop1,
		            prop2: prop2,
		            prop3: prop3,
		            prop4: prop4
		        },

		        session: _houdini_context_DO_NOT_USE.session(),
		        url: _houdini_context_DO_NOT_USE.url()
		    })
		});

		$:
		isBrowser && GQL_TestQuery.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: _TestQuery_Input
		});
	`)
})

test('2 queries, one paginated one not', async function () {
	const route = await component_test(`
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
    `)

	expect(route).toMatchInlineSnapshot(`
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";
		import { GQL_TestQuery2 } from "$houdini/stores/TestQuery2";
		import { GQL_TestQuery1 } from "$houdini/stores/TestQuery1";

		const {
		    data
		} = query(GQL_TestQuery1);

		const {
		    data: data2
		} = paginatedQuery(GQL_TestQuery2);

		const _houdini_context_DO_NOT_USE = getHoudiniContext();
		const _TestQuery1_Input = {};
		const _TestQuery2_Input = {};

		$:
		isBrowser && GQL_TestQuery1.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: _TestQuery1_Input
		});

		$:
		isBrowser && GQL_TestQuery2.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: _TestQuery2_Input
		});
	`)
})
