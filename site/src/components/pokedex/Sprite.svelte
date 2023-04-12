<script>
	export let loading = false
</script>

<div class="container" {...$$props}>
	{#if loading}
		<div class="shine" />
	{/if}
</div>

<style>
	.container {
		display: flex;
		image-rendering: pixelated;
		border: inset #9aa28b 3px;
		border-radius: 5px;
		margin: 10px 0;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		background: linear-gradient(
			15deg,
			#cad5b5 64%,
			#dde2d4 70%,
			#dde2d4 81%,
			#fff 86%,
			#dde2d4 89%,
			#dde2d4 100%
		);
		align-items: center;
		justify-content: center;
	}

	@keyframes displayShimmer {
		0% {
			background-position: -468px 0;
		}

		100% {
			background-position: 468px 0;
		}
	}

	.shine {
		background: rgba(0, 0, 0, 0);
		background-image: linear-gradient(
			to right,
			rgba(0, 0, 0, 0) 0%,
			rgb(214, 227, 208) 20%,
			rgba(0, 0, 0, 0) 40%
		);
		background-repeat: no-repeat;
		display: inline-block;
		position: relative;
		height: 100%;
		width: 100%;

		animation-duration: 1s;
		animation-fill-mode: forwards;
		animation-iteration-count: infinite;
		animation-name: displayShimmer;
		animation-timing-function: linear;
	}
</style>
