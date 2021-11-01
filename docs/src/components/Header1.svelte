<script lang="ts">
	import { onMount } from 'svelte'

	let header: HTMLHeadingElement

	onMount(() => {
		header.id = header.innerText.toLocaleLowerCase().replace(/ /g, '-')
	})
</script>

<hr />
<div class="container">
	<h1 bind:this={header} class="header">
		<slot />
	</h1>
	{#if header}
		<a href="#{header.id}">#</a>
	{/if}
</div>

<style>
	.container {
		display: flex;
		align-items: center;
		margin-bottom: 1rem;
		font-size: 1.5rem;
		line-height: 2rem;
		font-weight: 50;
	}

	a {
		opacity: 0;
		font-size: inherit;
		line-height: inherit;
		font-weight: 50;
		margin-left: 0.5rem;
		transition: opacity 200ms;
	}

	.container:hover a {
		opacity: 1;
	}

	.header {
		font-weight: inherit;
		color: var(--color1);
	}

	hr:first-child {
		display: none;
	}

	hr {
		margin-bottom: 2rem;
		margin-top: 2rem;
		width: 100%;
		height: 1px;
		background-color: rgb(226, 217, 217);
	}
</style>
