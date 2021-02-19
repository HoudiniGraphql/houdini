<script context="module" lang="ts">
	export function AllItemsVariables(page) {
		// if there is no filter assigned, dont enforce one in the query
		if (!page.params.filter || page.params.filter === 'all') {
			return {}
		}

		// make sure we recognize the value
		if (!['active', 'completed', 'all'].includes(page.params.filter)) {
			this.error(400, "filter must be one of 'active' or 'completed'")
			return
		}

		return {
			completed: page.params.filter === 'completed',
		}
	}
</script>

<script lang="ts">
	import { query, graphql } from 'houdini'
	import ItemEntry from '../components/ItemEntry.svelte'
	import type { AllItems } from '../../generated'

	// load the items
	const data = query<AllItems>(graphql`
		query AllItems($completed: Boolean) {
			items(completed: $completed) @connection(name: "All_Items") {
				id
				completed
				...ItemEntry_item
			}
		}
	`)
</script>

{#each $data.items as item (item.id)}
	<ItemEntry {item} />
{/each}
