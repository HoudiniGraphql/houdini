<script>
	import { Icon } from '.'
	export let title
	export let style = ''
	export let label = 'Deep Dive'

	let expanded = false
</script>

<div class="container-deepdive" {style}>
	<button on:click={() => (expanded = !expanded)}>
		<Icon name={expanded ? 'chevron-down' : 'chevron-right'} class="graphql-explained-icon" />
		{label}: {title}
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
