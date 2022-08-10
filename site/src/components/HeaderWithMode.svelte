<script lang="ts">
	import { page, session } from '$app/stores'
	import { setMode } from '~/lib/mode'

	export let title: string
	export let mode: 'inline' | 'store' = $page.url.pathname.split('/').slice(-1)[0] as
		| 'inline'
		| 'store'
</script>

<h1 id={title.toLowerCase()}>
	{#if mode === 'store'}
		{title} Store
	{:else}
		Inline {title}
	{/if}

	<nav id="document-api-links">
		<a
			sveltekit:prefetch
			on:click={() => setMode('inline')}
			class:current={mode === 'inline'}
			href="inline">Inline</a
		>
		<a
			sveltekit:prefetch
			on:click={() => setMode('store')}
			class:current={mode === 'store'}
			href="store">Store</a
		>
	</nav>
</h1>

<style>
	h1 {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
	}

	#document-api-links a {
		cursor: pointer;
		font-size: 24px;
		border-radius: 12px;
		padding: 3px 20px;
		color: white;
	}

	#document-api-links a.current {
		background-color: #ff3e00;
		color: #ffe7df;
	}
</style>
