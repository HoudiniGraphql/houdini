<script lang="ts">
	import { query, graphql } from 'houdini'
	import ItemEntry from '../components/ItemEntry.svelte'
	import type { CompletedItems } from '../../generated'

	// load the items
	const data = query<CompletedItems>(graphql`
		query CompletedItems {
			items(completed: true) @connection(name: "Completed_Items") {
				id
				completed
				...ItemEntry_item
			}
		}
	`, null)
</script>

{#each $data.items as item (item.id)}
	<ItemEntry {item} />
{/each}
