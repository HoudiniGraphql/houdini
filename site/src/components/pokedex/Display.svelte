<div id={$$props.id} class={$$props.class}>
	<slot />
</div>

<style>
	div {
		background: linear-gradient(14deg, rgb(165, 205, 83) 60%, rgb(193, 217, 144) 65%);
		padding: 5px;
		border-radius: 3px;
		font-family: 'VT323';
		border: inset #879a65 3px;
		color: black;
	}
</style>
