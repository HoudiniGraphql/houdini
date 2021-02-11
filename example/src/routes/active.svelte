<script lang="ts">
	import { query, graphql } from 'houdini'
	import ItemEntry from '../components/ItemEntry.svelte'
	import type { ActiveItems } from '../../generated'

	// load the items
	const data = query<ActiveItems>(graphql`
		query ActiveItems {
			items(completed: false) {
				id
				completed
				...ItemEntry_item
			}
		}
	`, null)
</script>

{#each $data.items as item}
	<ItemEntry {item} />
{/each}
