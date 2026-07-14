<script lang="ts">
import { invalidateAll } from '$app/navigation'
import { CachePolicy, graphql } from '$houdini'
import { onMount } from 'svelte'

// This query deliberately lives outside a SvelteKit load function. invalidateAll()
// cannot rerun it directly; a second request must come from Houdini's session watcher.
const session = graphql(`
	query ActiveSessionAfterInvalidate {
		session
	}
`)

onMount(() => {
	session.fetch({ policy: CachePolicy.NetworkOnly })
})

async function updateSession() {
	await fetch('/stores/session-refresh/update', { method: 'POST' })
	await invalidateAll()
}
</script>

<h1>Session Refresh</h1>

<div id="result">
  {$session.data?.session}
</div>

<button id="update-session" on:click={updateSession}>Update session</button>
