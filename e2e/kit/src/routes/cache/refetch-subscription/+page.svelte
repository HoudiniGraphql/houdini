<script lang="ts">
import { graphql } from '$houdini'
import { onMount } from 'svelte'
import UserDetails from './UserDetails.svelte'

const store = graphql(`
	query RefetchSubQuery {
		user(id: "1", snapshot: "cache-refetch-sub") {
			id
			...RefetchSubUserDetails
		}
	}
`)

// the subscription returns only the id, so it never writes a new name to the
// cache. with @refetch, the arriving event makes the query reload from the API
const updates = graphql(`
	subscription RefetchSubSubscription {
		userUpdate(id: "1", snapshot: "cache-refetch-sub") @refetch {
			id
		}
	}
`)

// the mutation returns only the id too, so it doesn't patch the name either —
// it just changes the server value and publishes the subscription event
const update = graphql(`
	mutation RefetchSubMutation($name: String!) {
		updateUser(id: "1", snapshot: "cache-refetch-sub", name: $name) {
			id
		}
	}
`)

onMount(() => {
	store.fetch()
})
</script>

<h1>Cache Refetch (subscription)</h1>

<button id="listen" on:click={() => updates.listen()}>listen</button>
<button id="mutate" on:click={() => update.mutate({ name: 'Samuel Jackson' })}>mutate</button>

{#if $store.data}
	<UserDetails user={$store.data.user} />
{/if}
