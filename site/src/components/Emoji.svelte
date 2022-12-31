<script>
	import { onMount } from 'svelte'

	export let name
	export let fallback
	export let height

	let data
	onMount(() => {
		console.log('mounting')
		const inMemoryImage = new Image()
		inMemoryImage.src = `/images/emojis/${name}.png`

		inMemoryImage.onload = function () {
			data = this.src
		}
	})
</script>

{#if data}
	<img src={data} height={`${height}px`} />
{:else}
	<span style={`font-size: ${height}px`}>
		{fallback}
	</span>
{/if}
