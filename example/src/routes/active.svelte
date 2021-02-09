<script>
	import { query, graphql } from 'houdini'
	import ItemEntry from '../components/ItemEntry.svelte'

	// load the items
	const data = query(graphql`
		query ActiveItems {
			items(completed: false) {
				id
				completed
				...ItemEntry_item
			}
		}
	`)
</script>

{#each $data.items as item}
	<ItemEntry {item} />
{/each}
