<script>
	import Icon from './Icon.svelte'
	export let disabled
</script>

<button class="arrow-button" on:click {disabled}>
	<Icon name="arrow-up" />
</button>

<style>
	button {
		cursor: default;
	}
</style>
