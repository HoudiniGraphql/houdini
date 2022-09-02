import { test, expect } from 'vitest'

import { transform_svelte_test } from '../../tests'

test('modifies root +layout.svelte to import adapter', async function () {
	// run the test
	const result = await transform_svelte_test(
		'src/routes/+layout.svelte',
		`
<script>
    export let data
</script>
    `
	)

	expect(result).toMatchInlineSnapshot(`
		import "$houdini/runtime/adapter";
		import __houdini_client__ from "PROJECT_ROOT/my/client/path";
		export let data;

		$:
		__houdini_client__.receiveServerSession(data);
	`)
})
