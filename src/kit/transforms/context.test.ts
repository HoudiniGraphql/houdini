import '../../../jest.setup'
import { component_test, route_test } from '../tests'

describe('context processor', function () {
	test('multiple imports', async function () {
		const route = await component_test(`
            import { GQL_Foo } from '$houdini'
            import { GQL_Bar } from '$houdini'
        `)

		expect(route).toMatchInlineSnapshot(`
		import { injectContext } from "$houdini/runtime/lib/context";
		import { GQL_Foo } from "$houdini";
		import { GQL_Bar } from "$houdini";

		injectContext({
		    GQL_Foo: GQL_Foo,
		    GQL_Bar: GQL_Bar
		});
	`)
	})

	test('direct store imports', async function () {
		const route = await component_test(`
            import Foo from '$houdini/stores/Foo'
        `)

		expect(route).toMatchInlineSnapshot(`
		import { injectContext } from "$houdini/runtime/lib/context";
		import Foo from "$houdini/stores/Foo";

		injectContext({
		    Foo: Foo
		});
	`)
	})
})
