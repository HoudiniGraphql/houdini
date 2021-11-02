<script>
	import TableOfContents from '$components/TableOfContents.svelte'
	import TopBar from '$components/TopBar.svelte'
</script>

<div>
	<TopBar />
	<div class="wrapper">
		<TableOfContents />

		<slot />
	</div>
</div>

<style>
	.wrapper {
		display: grid;
		grid-template-columns:
			1fr
			min(65ch, 100%)
			1fr;
	}

	@media (max-width: 600px) {
		.wrapper {
			display: grid;
			grid-template-columns: 1fr min(60ch, calc(100% - 64px)) 1fr;
			grid-column-gap: 32px;
		}
	}
</style>
