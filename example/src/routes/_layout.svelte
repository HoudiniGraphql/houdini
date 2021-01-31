<script context="module">
	import { getQuery, graphql } from 'houdini'

	export async function preload() {
		// load some data at the top of the app for general information
		const data = await getQuery(graphql`
			query IndexInfo {
				items {
					completed
				}
			}
		`)

		return {
			itemsLeft: data.items.filter((item) => !item.completed).length,
			hasCompleted: Boolean(data.items.find((item) => item.completed)),
		}
	}
</script>

<script>
	export let itemsLeft
	export let hasCompleted
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
		<section class="main">
			<ul class="todo-list">
				<slot />
			</ul>
		</section>
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
	</header>
</section>
