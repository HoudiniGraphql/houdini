<script context="module" lang="ts">
	// import { browser } from '$app/env'
	import { GQL_AllItems } from '$houdini'
	import type { LoadInput } from '@sveltejs/kit'

	export async function load(loadInput: LoadInput) {
		// Option 1: in Load (SSR)
		await GQL_AllItems.load(loadInput, { variables: { completed: true } })
		return {}
	}
</script>

<script lang="ts">
	// Option 2: in component (CSR)
	// $: browser && GQL_AllItems.query()

	async function all() {
		await GQL_AllItems.query()
	}
	async function active() {
		await GQL_AllItems.query({ variables: { completed: false } })
	}
	async function completed() {
		let ttt = await GQL_AllItems.query({ variables: { completed: true } })
	}
</script>

<h1>Store</h1>

<button on:click={all}>All</button>
<button on:click={active}>Active</button>
<button on:click={completed}>Completed</button>
<hr />
{JSON.stringify($GQL_AllItems, null, 2)}
