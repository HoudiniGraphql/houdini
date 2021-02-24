<script lang="ts">
	import { query, graphql, mutation } from 'houdini'
	import { derived } from 'svelte/store'
	import { stores } from '@sapper/app'
	import type { IndexInfo, AddItem } from '../../generated'

	// load some data at the top of the app for general information
	const data = query<IndexInfo>(graphql`
		query IndexInfo {
			items @connection(name: "Item_Info") {
				id
				completed
			}
		}
	`)

	// grab the session store to pass to the mutation
	const { page } = stores()

	// state and handler for the new item input
	const addItem = mutation<AddItem>(
		graphql`
			mutation AddItem($input: AddItemInput!) {
				addItem(input: $input) {
					item {
						...All_Items_insert @prepend(when_not: { argument: "completed", value: "true" })
						...Item_Info_insert
					}
				}
			}
		`
	)
	let inputValue = ''
	async function onBlur() {
		// trigger the mutation
		await addItem({ input: { text: inputValue } })

		// clear the input
		inputValue = ''
	}

	const numberOfItems = derived(data, ($data) => $data.items.length)
	const itemsLeft = derived(data, ($data) => $data.items.filter((item) => !item.completed).length)
	const hasCompleted = derived(data, ($data) => Boolean($data.items.find((item) => item.completed)))

	// figure out the current page
	const currentPage = derived(page, ($page) => {
		if ($page.path.includes('active')) {
			return 'active'
		} else if ($page.path.includes('completed')) {
			return 'completed'
		}
		return 'all'
	})
</script>

<svelte:head>
	<title>Houdini • TodoMVC</title>
	<link rel="stylesheet" href="//unpkg.com/todomvc-common/base.css" />
	<link rel="stylesheet" href="//unpkg.com/todomvc-app-css/index.css" />
</svelte:head>

<section class="todoapp">
	<header class="header">
		<a href="/">
			<h1>todos</h1>
		</a>
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
			<slot />
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
			{#if $hasCompleted}
				<button class="clear-completed">Clear completed</button>
			{/if}
		</footer>
	{/if}
</section>
<footer class="info">
	<p>Double-click to edit a todo</p>
	<p>Created by <a href="http://todomvc.com">Alec Aivazis</a></p>
	<p>Part of <a href="http://todomvc.com">TodoMVC</a></p>
</footer>
