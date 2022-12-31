<script>
	import { onMount } from 'svelte'

	export let name
	export let fallback
	export let height
</script>

<img src={`/images/emojis/${name}.png`} height={`${height}px`} alt={name} />
