import { test, expect, vi } from 'vitest'

import { component_test } from '../../test'

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
		import { TestQueryStore } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
		import { isBrowser } from "$houdini/plugins/houdini-svelte/runtime/adapter";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
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
		import { TestQueryStore } from "$houdini/plugins/houdini-svelte/stores/TestQuery";
		import { isBrowser } from "$houdini/plugins/houdini-svelte/runtime/adapter";
		import { RequestContext } from "$houdini/plugins/houdini-svelte/runtime/session";
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
		    input: {}
		}).then(_TestQuery_Input => isBrowser && _houdini_TestQuery.fetch({
		    variables: _TestQuery_Input
		}));
	`)
})

test('missing variables', async function () {
	vi.spyOn(console, 'error')

	await component_test(
		`
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
	expect(console.error).toHaveBeenCalled()
	// @ts-ignore
	expect(console.error.mock.calls).toMatchInlineSnapshot(
		`
		[
		    [
		        "❌ Encountered error in src/lib/component.svelte"
		    ],
		    [
		        "Could not find required variable function: \\u001b[33m_TestQueryVariables\\u001b[37m\\u001b[0m. maybe its not exported? "
		    ]
		]
	`
	)
})
