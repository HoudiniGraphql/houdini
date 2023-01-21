<script>
	import { Icon } from '.'
	export let title
	export let style = ''

	let expanded = false
</script>

<div class="container" {style}>
	<button on:click={() => (expanded = !expanded)}>
		<Icon name={expanded ? 'chevron-down' : 'chevron-right'} class="graphql-explained-icon" />
		Deep Dive: {title}
	</button>
	{#if expanded}
		<div class="content">
			<slot />
		</div>
	{/if}
</div>

<style>
	:global(.graphql-explained-icon) {
		margin-right: 10px;
	}

	.container {
		border-radius: 10px;
		background-color: var(--deep-dive-background);
		margin-bottom: 60px;
		margin-top: 30px;
	}

	button {
		background: var(--deep-dive);
		border-radius: 10px;
		display: flex;
		flex-direction: row;
		align-items: center;
		padding: 15px;
		font-family: 'Hind', sans-serif;
		font-size: 20px;
		width: 100%;
		border: none;
		color: var(--deep-dive-text);
		cursor: pointer;
	}

	.content {
		padding: 30px;
	}
</style>
