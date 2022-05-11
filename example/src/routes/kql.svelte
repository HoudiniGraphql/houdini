<script context="module" lang="ts">
	// import { browser } from '$app/env'
	import { KQL_AllItems } from '$houdini'
	import type { LoadInput } from '@sveltejs/kit'

	export async function load(loadInput: LoadInput) {
		// Option 1: in Load (SSR)
		await KQL_AllItems.queryLoad(loadInput, { variables: { completed: true } })
		return {}
	}
</script>

<script lang="ts">
	// Option 2: in component (CSR)
	// $: browser && KQL_AllItems.query()

	async function all() {
		await KQL_AllItems.query()
	}
	async function active() {
		await KQL_AllItems.query({ variables: { completed: false } })
	}
	async function completed() {
		await KQL_AllItems.query({ variables: { completed: true } })
	}
</script>

<h1>Store</h1>

<button on:click={all}>All</button>
<button on:click={active}>Active</button>
<button on:click={completed}>Completed</button>
<hr />
{JSON.stringify($KQL_AllItems, null, 2)}
