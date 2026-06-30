<script lang="ts">
import { graphql } from '$houdini'
import { onMount } from 'svelte'
import UserDetails from './UserDetails.svelte'

const store = graphql(`
	query RefetchCacheQuery {
		user(id: "1", snapshot: "cache-refetch") {
			id
			...RefetchCacheUserDetails
		}
	}
`)

const update = graphql(`
	mutation RefetchCacheMutation {
		updateUser(id: "1", snapshot: "cache-refetch", name: "Samuel Jackson") @refetch {
			id
		}
	}
`)

onMount(() => {
	store.fetch()
})
</script>

<h1>Cache Refetch</h1>

{#if $store.data}
	<UserDetails user={$store.data.user} />
{/if}

<button id="mutate" on:click={() => update.mutate(null)}>mutate</button>
