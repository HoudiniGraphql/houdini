<script>
	export let name
	export let fallback
	export let height
	export let style = ''
</script>

<img src={`/images/emojis/${name}.png`} height={`${height}px`} alt={name} {style} />
