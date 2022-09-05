import { test, expect } from 'vitest'

import { test_transform_svelte } from '../../tests'

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
		import { setSession, sessionKeyName } from "$houdini/runtime/lib/network";
		import { onMount } from "svelte";
		import { setClientStarted } from "$houdini/runtime/adapter";
		export let data;
		onMount(() => setClientStarted());

		page.subscribe(val => {
		    setSession(val.data[sessionKeyName]);
		});
	`)
})
