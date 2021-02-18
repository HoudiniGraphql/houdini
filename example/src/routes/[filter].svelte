<script lang="ts">
	import { query, graphql } from 'houdini'
	import ItemEntry from '../components/ItemEntry.svelte'
	import type { AllItems } from '../../generated'

	// load the items
	const data = query<AllItems>(graphql`
		query AllItems {
			items @connection(name: "All_Items") {
				id
				completed
				...ItemEntry_item
			}
		}
	`)
</script>

<script context="module" lang="ts">
    export function AllItemsVariables(page) {
		// if there is no filter assigned, dont enforce one in the query
		if (!page.params.filter) {
			return {}
		}	

		// make sure we recognize the value
		if (!['active', 'completed'].includes(page.params)) { 
			this.error(400, "filter must be one of 'active' or 'completed'")
			return
		}

		return { 
			completed: page.params.filter === 'completed'
		}
    }
</script>

{#each $data.items as item (item.id)}
	<ItemEntry {item} />
{/each}
