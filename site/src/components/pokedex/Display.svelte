<script>
	export let loading = false
</script>

<div id={$$props.id} class="container" style={$$props.style}>
	<slot />
	{#if loading}
		<div class="shine" />
	{/if}
</div>

<style>
	.container {
		background: linear-gradient(14deg, rgb(165, 205, 83) 60%, rgb(193, 217, 144) 65%);
		padding: 5px;
		border-radius: 3px;
		font-family: 'VT323';
		border: inset #879a65 3px;
		color: black;
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
			rgb(213, 243, 153) 20%,
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
