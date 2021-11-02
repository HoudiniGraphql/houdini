<script>
	import Search from './Search.svelte'
</script>

<div class="top-bar">
	<Search />
</div>

<style>
	.top-bar {
		width: 100%;
		position: absolute;
		z-index: 20;
		height: 3.5rem;
		background-color: #fafbff;
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
		display: flex;
		flex-direction: row-reverse;
		align-items: center;
		padding: 0 2rem;
	}
</style>
