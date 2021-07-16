<script context="module" lang="ts">
	export function AllItemsVariables({ page }) {
		// if there is no filter assigned, dont enforce one in the query
		if (!page.params.filter || page.params.filter === 'all') {
			return {}
		}

		// make sure we recognize the value
		if (!['active', 'completed', 'all'].includes(page.params.filter)) {
			return this.error(400, "filter must be one of 'active' or 'completed'")
		}

		return {
			completed: page.params.filter === 'completed',
		}
	}

</script>

<script lang="ts">
	import { query, graphql, mutation, subscription, AllItems } from '$houdini'
	import ItemEntry from '$lib/ItemEntry.svelte'
	import { page } from '$app/stores'
	import { derived } from 'svelte/store'

	// load the items
	const { data } = query<AllItems>(graphql`
		query AllItems($completed: Boolean) {
			filteredItems: items(completed: $completed, first: 2) @paginate  {
				edges { 
					node { 
						id
						completed
						...ItemEntry_item
					}
				}
			}
			allItems: items  {
				edges { 
					node { 
						id
						completed
					}
				}
			}
		}
	`)

	const numberOfItems = derived(data, ($data) => $data.allItems.edges.length)
	const itemsLeft = derived(
		data,
		($data) => $data.allItems.edges.filter(({node: item}) => !item.completed).length
	)

	// figure out the current page
	const currentPage = derived(page, ($page) => {
		if ($page.path.includes('active')) {
			return 'active'
		} else if ($page.path.includes('completed')) {
			return 'completed'
		}
		return 'all'
	})

	let inputValue = ''
	async function onBlur() {
		if (inputValue) {
			// trigger the mutation
			// await addItem({ input: { text: inputValue } })

			// clear the input
			inputValue = ''
		}
	}

</script>

<header class="header">
	<a href="/">
		<h1>todos</h1>
	</a>
	<nav>
		<button>load more</button>
	</nav>
	<input
		class="new-todo"
		placeholder="What needs to be done?"
		bind:value={inputValue}
		on:blur={onBlur}
	/>
</header>
<section class="main">
	<input id="toggle-all" class="toggle-all" type="checkbox" />
	<label for="toggle-all">Mark all as complete</label>
	<ul class="todo-list">
		{#each $data.filteredItems.edges as edge (edge.node.id)}
			<ItemEntry item={edge.node} />
		{/each}
	</ul>
</section>
{#if $numberOfItems > 0}
	<footer class="footer">
		<span class="todo-count"><strong>{$itemsLeft}</strong> item left</span>
		<ul class="filters">
			<li>
				<a class:selected={$currentPage === 'all'} class="selected" href="/">All</a>
			</li>
			<li>
				<a class:selected={$currentPage === 'active'} href="/active">Active</a>
			</li>
			<li>
				<a class:selected={$currentPage === 'completed'} href="/completed">Completed</a>
			</li>
		</ul>
	</footer>
{/if}
