<script>
	import Container from './Container.svelte'
	import Panel from './Panel.svelte'
	import Display from './Display.svelte'
</script>

<div class="container">
	<Container>
		<Panel slot="left">
			<Display style="height:30px" />
		</Panel>
		<Panel slot="right">
			<Display style="height:30px" />
		</Panel>
	</Container>
</div>

<style>
	.container {
		display: flex;
		flex-direction: row;
		justify-content: center;
	}
</style>
