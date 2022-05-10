<script context="module" lang="ts">
	import { KQL_AllItems } from '$houdini/stores/KQL_AllItems' // Todo lighten the import to from '$houdini'
	import { onMount } from 'svelte'

	export async function load(args) {
		await KQL_AllItems.load(args)
		return {}
	}
</script>

<script lang="ts">
	onMount(async () => {
		await KQL_AllItems.query()
	})
</script>

<h1>Store 👇</h1>
{JSON.stringify($KQL_AllItems, null, 2)}
