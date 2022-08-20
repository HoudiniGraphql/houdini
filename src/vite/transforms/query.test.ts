import { test, expect } from 'vitest'

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
		import { marshalInputs } from "$houdini/runtime/lib/scalars";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";
		const _houdini_TestQuery = new TestQueryStore();

		$:
		({
		    data
		} = query(_houdini_TestQuery));

		const _houdini_context_DO_NOT_USE = getHoudiniContext();
		let _TestQuery_Input = {};

		$:
		marshalInputs({
		    artifact: _houdini_TestQuery.artifact,
		    input: {}
		}).then(_TestQuery_Input => isBrowser && _houdini_TestQuery.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: _TestQuery_Input
		}));
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
		import { marshalInputs } from "$houdini/runtime/lib/scalars";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";
		const _houdini_TestQuery = new TestQueryStore();

		export function TestQueryVariables() {
		    return {
		        hello: "world"
		    };
		}

		export let prop1 = "hello";
		export const prop2 = "goodbye";
		export let prop3, prop4;

		$:
		({
		    data
		} = query(_houdini_TestQuery));

		const _houdini_context_DO_NOT_USE = getHoudiniContext();
		let _TestQuery_Input = {};

		$:
		marshalInputs({
		    artifact: _houdini_TestQuery.artifact,

		    input: TestQueryVariables.call(_houdini_context_DO_NOT_USE, {
		        props: {
		            prop1: prop1,
		            prop2: prop2,
		            prop3: prop3,
		            prop4: prop4
		        }
		    })
		}).then(_TestQuery_Input => isBrowser && _houdini_TestQuery.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: _TestQuery_Input
		}));
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
		import { marshalInputs } from "$houdini/runtime/lib/scalars";
		import { getHoudiniContext } from "$houdini/runtime/lib/context";
		const _houdini_TestQuery2 = new TestQuery2Store();
		const _houdini_TestQuery1 = new TestQuery1Store();

		$:
		({
		    data
		} = query(_houdini_TestQuery1));

		$:
		({
		    data: data2
		} = paginatedQuery(_houdini_TestQuery2));

		const _houdini_context_DO_NOT_USE = getHoudiniContext();
		let _TestQuery1_Input = {};

		$:
		marshalInputs({
		    artifact: _houdini_TestQuery1.artifact,
		    input: {}
		}).then(_TestQuery1_Input => isBrowser && _houdini_TestQuery1.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: _TestQuery1_Input
		}));

		let _TestQuery2_Input = {};

		$:
		marshalInputs({
		    artifact: _houdini_TestQuery2.artifact,
		    input: {}
		}).then(_TestQuery2_Input => isBrowser && _houdini_TestQuery2.fetch({
		    context: _houdini_context_DO_NOT_USE,
		    variables: _TestQuery2_Input
		}));
	`)
})
