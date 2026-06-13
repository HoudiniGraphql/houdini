<script lang="ts">
import { cache, graphql } from '$houdini'
import { onMount } from 'svelte'
import UserDetails from './UserDetails.svelte'

const store = graphql(`
	query RefreshCacheQuery {
		user(id: "1", snapshot: "cache-refresh") {
			id
			...RefreshCacheUserDetails
		}
	}
`)

onMount(() => {
	store.fetch()
})
</script>

<h1>Cache Refresh</h1>

{#if $store.data}
	<UserDetails user={$store.data.user} />
{/if}

<button
	id="refresh"
	on:click={() => {
		if ($store.data) {
			cache.get('User', { id: $store.data.user.id }).refresh()
		}
	}}>refresh</button
>
