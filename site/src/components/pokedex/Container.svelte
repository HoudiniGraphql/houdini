<script>
	import Case from './Case.svelte'
</script>

<div class="pokedex">
	<Case width="100%" height="auto" />
	<div class="left">
		<slot name="left" />
	</div>
	<div class="right">
		<slot name="right" />
	</div>
</div>

<style>
	.pokedex {
		width: 600px;
		height: 455px;
		position: relative;
	}

	.left {
		position: absolute;
		top: calc(20% + 10px);
		left: 13px;
		width: 44%;
		height: 70%;
	}

	.right {
		position: absolute;
		top: calc(20% + 10px);
		right: 18px;
		width: 44%;
		height: 70%;
	}
</style>
