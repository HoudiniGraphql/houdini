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
		import { TestQueryStore } from "$houdini/stores/TestQuery";
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";
		const _houdini_TestQuery = TestQueryStore();

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
		} = query(_houdini_TestQuery);

		const _houdini_context_DO_NOT_USE = getHoudiniContext();

		$:
		_TestQuery_Input = marshalInputs({
		    config: houdiniConfig,
		    artifact: _houdini_TestQuery.artifact,

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
		isBrowser && _houdini_TestQuery.fetch({
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
		import { TestQuery2Store } from "$houdini/stores/TestQuery2";
		import { TestQuery1Store } from "$houdini/stores/TestQuery1";
		import { isBrowser } from "$houdini/runtime/adapter";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";
		const _houdini_TestQuery2 = TestQuery2Store();
		const _houdini_TestQuery1 = TestQuery1Store();

		const {
		    data
		} = query(_houdini_TestQuery1);

		const {
		    data: data2
		} = paginatedQuery(_houdini_TestQuery2);

		const _houdini_context_DO_NOT_USE = getHoudiniContext();

		$:
		_TestQuery1_Input = {};

		$:
		isBrowser && _houdini_TestQuery1.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: _TestQuery1_Input
		});

		$:
		_TestQuery2_Input = {};

		$:
		isBrowser && _houdini_TestQuery2.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: _TestQuery2_Input
		});
	`)
})
