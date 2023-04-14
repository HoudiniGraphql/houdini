import { test, expect } from 'vitest'

import { test_transform_svelte } from '../../../test'

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
		import { extractSession, setClientSession } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { onMount } from "svelte";
		import { setClientStarted } from "$houdini/plugins/houdini-svelte/runtime/adapter";
		export let data
		onMount(() => setClientStarted());

		page.subscribe(val => {
		    setClientSession(extractSession(val.data));
		});
	`)
})
