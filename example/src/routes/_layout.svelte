<script context="module">
	import { query, graphql } from 'houdini'

	export async function preload() {
		// load some data at the top of the app for general information
		const data = await query(graphql`
			query IndexInfo {
				items {
					completed
				}
			}
		`)

		return {
			numberOfItems: data.items.length,
			itemsLeft: data.items.filter((item) => !item.completed).length,
			hasCompleted: Boolean(data.items.find((item) => item.completed)),
		}
	}
</script>

<script>
	export let itemsLeft
	export let hasCompleted
	export let numberOfItems
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
		<input class="new-todo" placeholder="What needs to be done?" />
	</header>
	<section class="main">
		<input id="toggle-all" class="toggle-all" type="checkbox" />
		<label for="toggle-all">Mark all as complete</label>
		<ul class="todo-list">
			<slot />
		</ul>
	</section>
	{#if numberOfItems > 0}
		<footer class="footer">
			<span class="todo-count"><strong>{itemsLeft}</strong> item left</span>
			<ul class="filters">
				<li>
					<a class="selected" href="/">All</a>
				</li>
				<li>
					<a href="/active">Active</a>
				</li>
				<li>
					<a href="/completed">Completed</a>
				</li>
			</ul>
			{#if hasCompleted}
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
