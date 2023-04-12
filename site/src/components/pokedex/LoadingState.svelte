<script>
	import Container from './Container.svelte'
	import Panel from './Panel.svelte'
	import Display from './Display.svelte'
</script>

<Container>
	<Panel slot="left">
		<Display style="height:30px" />
	</Panel>
	<Panel slot="right" />
</Container>
