import { test, expect } from 'vitest'

import { test_transform_svelte } from './test'

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
		import { deepEquals } from "houdini/runtime";
		import { getCache } from "$houdini";
		import { page } from "$app/state";
		import { extractSession, getClientSession, setClientSession } from "$houdini/plugins/houdini-svelte/runtime/session";
		import { onMount } from "svelte";
		import { setClientStarted } from "$houdini/plugins/houdini-svelte/runtime/adapter";
		export let data
		let houdini__session__initialized = false;
		onMount(() => setClientStarted());

		$effect(() => {
		    const nextSession = extractSession(page.data);
		    const sessionChanged = houdini__session__initialized && !deepEquals(getClientSession(), nextSession);
		    setClientSession(nextSession);
		    houdini__session__initialized = true;

		    if (sessionChanged) {
		        getCache().refreshAll({
		            session: nextSession
		        });
		    }
		});
	`)
})
