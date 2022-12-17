import { test, expect, vi } from 'vitest'

import { component_test } from '../../test'

test('graphql template tag in a function', async function () {
	const route = await component_test(
		`
            const result = fragment(user, graphql\`
                fragment Foo on Bar {
                    users(stringValue: $test) {
                        id
                    }
                }
            \`)
		`
	)

	// make sure we added the right stuff
	expect(route).toMatchInlineSnapshot(`
		import GQL_Foo from "$houdini/plugins/houdini-svelte/stores/Foo";

		$:
		result = fragment(user, GQL_Foo);
	`)
})

test('graphql function in a function', async function () {
	const route = await component_test(
		`
            const result = fragment(user, graphql\`
                fragment Foo on Bar {
                    users(stringValue: $test) {
                        id
                    }
                }
            \`)
		`
	)

	// make sure we added the right stuff
	expect(route).toMatchInlineSnapshot(`
		import GQL_Foo from "$houdini/plugins/houdini-svelte/stores/Foo";

		$:
		result = fragment(user, GQL_Foo);
	`)
})

test('graphql function in a function', async function () {
	const route = await component_test(
		`
            const result = fragment(user, graphql(\`
                fragment Foo on Bar {
                    users(stringValue: $test) {
                        id
                    }
                }
            \`))
		`
	)

	// make sure we added the right stuff
	expect(route).toMatchInlineSnapshot(`
		import GQL_Foo from "$houdini/plugins/houdini-svelte/stores/Foo";

		$:
		result = fragment(user, GQL_Foo);
	`)
})
