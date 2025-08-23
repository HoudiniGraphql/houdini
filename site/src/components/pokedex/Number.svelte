<script>
	export let value
	const Is = Array.from({ length: value })
		.map(() => 'I')
		.join('')
</script>

<div>
	{Is}
</div>

<style>
	div {
		text-align: center;
		font-family: 'Staatliches', cursive;
		font-size: 1.25em;
		letter-spacing: 2px;
		background: transparent;
		border: none;
		text-shadow: #e78181 -1px 1px;
		color: black;
	}
</style>
