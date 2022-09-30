import { component_test } from 'houdini/vite/tests'
import { test, expect } from 'vitest'

test('no variables', async function () {
	const route = await component_test(
		`
            const value = graphql\`
                query TestQuery {
                    viewer {
                        id
                    }
                }
            \`
		`
	)

	// make sure we added the right stuff
	expect(route).toMatchInlineSnapshot(`
		import { TestQueryStore } from "$houdini/stores/TestQuery";
		import { isBrowser } from "$houdini/runtime/adapter";
		import { RequestContext } from "$houdini/runtime/lib/network";
		import { marshalInputs } from "$houdini/runtime/lib/scalars";
		const _houdini_TestQuery = new TestQueryStore();

		$:
		value = _houdini_TestQuery;

		$:
		marshalInputs({
		    artifact: _houdini_TestQuery.artifact,
		    input: {}
		}).then(_TestQuery_Input => isBrowser && _houdini_TestQuery.fetch({
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

            const result = graphql\`
                query TestQuery($test: String!) {
                    users(stringValue: $test) {
                        id
                    }
                }
            \`
		`
	)

	// make sure we added the right stuff
	expect(route).toMatchInlineSnapshot(`
		import { TestQueryStore } from "$houdini/stores/TestQuery";
		import { isBrowser } from "$houdini/runtime/adapter";
		import { RequestContext } from "$houdini/runtime/lib/network";
		import { marshalInputs } from "$houdini/runtime/lib/scalars";
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
		result = _houdini_TestQuery;

		$:
		marshalInputs({
		    artifact: _houdini_TestQuery.artifact,

		    input: TestQueryVariables.call(new RequestContext(), {
		        props: {
		            prop1: prop1,
		            prop2: prop2,
		            prop3: prop3,
		            prop4: prop4
		        }
		    })
		}).then(_TestQuery_Input => isBrowser && _houdini_TestQuery.fetch({
		    variables: _TestQuery_Input
		}));
	`)
})
