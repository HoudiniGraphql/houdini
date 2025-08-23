<script>
	import { Icon } from '.'
	export let title

	let expanded = false
</script>

<div class="container-deepdive">
	<button on:click={() => (expanded = !expanded)}>
		<Icon name={expanded ? 'chevron-down' : 'chevron-right'} class="graphql-explained-icon" />
		GraphQL Explained: {title}
	</button>
	{#if expanded}
		<div class="content">
			<slot />
		</div>
	{/if}
</div>

<style>
	button {
		background: var(--graphql-explained);
		border-radius: 10px;
		display: flex;
		flex-direction: row;
		align-items: center;
		padding: 15px;
		font-family: 'Hind', sans-serif;
		font-size: 20px;
		width: 100%;
		border: none;
		color: white;
		cursor: pointer;
	}

	.content {
		padding: 30px;
	}
</style>
