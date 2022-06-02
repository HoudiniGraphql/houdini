<script context="module" lang="ts">
	// import { browser } from '$app/env'
	import { CachePolicy, GQL_AllItems } from '$houdini'
	import type { LoadEvent } from '@sveltejs/kit'

	export async function load(context: LoadEvent) {
		// Option 1: in Load (SSR)
		await GQL_AllItems.fetch({ variables: { completed: true } })
		return {}
	}
</script>

<script lang="ts">
	// Option 2: in component (CSR)
	// $: browser && GQL_AllItems.query()

	async function all() {
		await GQL_AllItems.fetch()
	}
	async function active() {
		await GQL_AllItems.fetch({ variables: { completed: false } })
	}
	async function completed() {
		let allItems = await GQL_AllItems.fetch({
			variables: { completed: true },
			policy: CachePolicy.NetworkOnly,
		})
	}
</script>

<h1>Store</h1>

<button on:click={all}>All</button>
<button on:click={active}>Active</button>
<button on:click={completed}>Completed</button>
<hr />
{JSON.stringify($GQL_AllItems, null, 2)}
