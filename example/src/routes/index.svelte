<script context="module">
	import { getQuery, graphql } from 'houdini'

	export async function preload() {
		const data = await getQuery(graphql`
			query AllItems {
				items {
					...ItemEntry_item
					completed
				}
			}
		`)

		return { data }
	}
</script>

<script>
	import ItemEntry from '../components/ItemEntry.svelte'

	export let data
</script>

{#each data.items as item}
	<ItemEntry {item} />
{/each}
