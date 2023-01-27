<script>
	export let source

	$: background = 'var(--hue)'
	$: lineColor = 'var(--contrast)'
	$: black = 'black'
</script>

{@html source
	.replace('#ffffff', background)
	.replaceAll('#000000', lineColor)
	.replaceAll('#c92a2a', black)}
