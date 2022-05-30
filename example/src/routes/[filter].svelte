<script context="module" lang="ts">
	export function AllItemsVariables({ params }) {
		// if there is no filter assigned, dont enforce one in the query
		if (!params.filter || params.filter === 'all') {
			return {}
		}

		// make sure we recognize the value
		if (!['active', 'completed', 'all'].includes(params.filter)) {
			return this.error(400, "filter must be one of 'active' or 'completed'")
		}

		return {
			completed: params.filter === 'completed',
		}
	}
</script>

<script lang="ts">
	import { page } from '$app/stores'
	import type { AddItem, AllItems } from '$houdini'
	import { graphql, mutation, paginatedQuery, subscription } from '$houdini'
	import ItemEntry from '$lib/ItemEntry.svelte'
	import { derived } from 'svelte/store'

	// load the items
	const { data, pageInfo, loadNextPage } = paginatedQuery<AllItems>(graphql`
		query AllItems($completed: Boolean) @cache(policy: CacheOrNetwork) {
			filteredItems: items(completed: $completed, first: 2)
				@paginate(name: "Filtered_Items") {
				edges {
					node {
						id
						completed
						...ItemEntry_item
					}
				}
			}
			allItems: items @list(name: "All_Items") {
				edges {
					node {
						id
						text
						completed
					}
				}
			}
		}
	`)

	// state and handler for the new item input
	const addItem = mutation<AddItem>(graphql`
		mutation AddItem($input: AddItemInput!) {
			addItem(input: $input) {
				error {
					message
				}
			}
		}
	`)

	subscription(graphql`
		subscription NewItem {
			newItem {
				item {
					...All_Items_insert
					...Filtered_Items_insert @prepend(when_not: { completed: true })
				}
			}
		}
	`)

	$: numberOfItems = $data.allItems.edges.length
	$: itemsLeft = $data.allItems.edges.filter(({ node: item }) => !item.completed).length

	// figure out the current page
	const currentPage = derived(page, ($page) => {
		if ($page.url.pathname.includes('active')) {
			return 'active'
		} else if ($page.url.pathname.includes('completed')) {
			return 'completed'
		}
		return 'all'
	})

	let inputValue = ''
	async function onBlur() {
		if (inputValue) {
			// trigger the mutation
			await addItem({ input: { text: inputValue } })

			// clear the input
			inputValue = ''
		}
	}
</script>

<header class="header">
	<a href="/">
		<h1>todos</h1>
	</a>
	{#if $pageInfo.hasNextPage}
		<nav>
			<button on:click={() => loadNextPage()}>load more</button>
		</nav>
	{/if}
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
{#if numberOfItems > 0}
	<footer class="footer">
		<span class="todo-count"><strong>{itemsLeft}</strong> item left</span>
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

<style>
	nav {
		position: absolute;
		right: 0;
		top: -30px;
	}

	button {
		border: 1px solid darkgray;
		border-radius: 3px;
		padding: 4px;
		background: white;
		cursor: pointer;
	}

	button:active {
		background: #f6f6f6;
	}
</style>
