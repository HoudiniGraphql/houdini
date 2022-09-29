import { test_transform_svelte } from 'houdini/vite/tests'
import { test, expect } from 'vitest'

test('modifies root +layout.svelte to import adapter', async function () {
	// run the test
	const result = await test_transform_svelte(
		'src/routes/+layout.svelte',
		`
<script>
    export let data
</script>
    `
	)

	expect(result).toMatchInlineSnapshot(`
		import { page } from "$app/stores";
		import { extractSession, setSession } from "$houdini/runtime/lib/network";
		import { onMount } from "svelte";
		import { setClientStarted } from "$houdini/runtime/adapter";
		export let data;
		onMount(() => setClientStarted());

		page.subscribe(val => {
		    setSession(extractSession(val.data));
		});
	`)
})
