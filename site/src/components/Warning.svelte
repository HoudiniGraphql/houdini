<div class="container message">
	<h3>Careful!</h3>
	<slot />
</div>

<style>
	.container {
		border-radius: 10px;
		background-color: var(--warning);
		margin-bottom: 60px;
		margin-top: 30px;
		padding: 10px 30px 0 30px;
		color: var(--warning-text);
	}

	h3 {
		margin-bottom: 12px;
		font-size: 26px !important;
	}
</style>
