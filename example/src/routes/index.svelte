<script lang="ts">
	import { query, graphql } from 'houdini'
	import ItemEntry from '../components/ItemEntry.svelte'
	import type { AllItems, CompleteItem } from '../../generated'

	// load the items
	const data = query<AllItems>(graphql`
		query AllItems {
			items {
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
