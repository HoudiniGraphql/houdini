<script context="module" lang="ts">
	import { browser } from '$app/env'
	import { KQL_AllItems } from '$houdini'
	import type { LoadInput } from '@sveltejs/kit'

	export async function load(loadInput: LoadInput) {
		// await KQL_AllItems.queryLoad(loadInput)
		return {}
	}
</script>

<script lang="ts">
	$: browser && KQL_AllItems.query()
</script>

<h1>Store 👇</h1>
{JSON.stringify($KQL_AllItems, null, 2)}
