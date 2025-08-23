<div class={`block ${$$props.class}`}>
	<slot />
</div>

<style>
	.block {
		background: var(--dark-grey);
		border: 1px solid var(--grey);
		border-radius: 16px;
		box-shadow: 0 16px 50px 0 rgba(0, 0, 0, 0.35);
	}
</style>
