<script>
	import { query, graphql } from 'houdini'
	import ItemEntry from '../components/ItemEntry.svelte'

	// load the items
	const data = query(graphql`
		query AllItems {
			items {
				...ItemEntry_item
				completed
			}
		}
	`)
</script>

{#each $data.items as item}
	<ItemEntry {item} />
{/each}
