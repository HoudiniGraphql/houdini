<script>
	import Container from './Case.svelte'
	import Panel from './Panel.svelte'
	import Display from './Display.svelte'
	import Sprite from './Sprite.svelte'
	import Number from './Number.svelte'
	import UpButton from './UpButton.svelte'
	import DownButton from './DownButton.svelte'
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link
		href="https://fonts.googleapis.com/css2?family=Staatliches&family=VT323&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="container" id="pokedex">
	<Container>
		<Panel slot="left">
			<Display style="height:30px" loading />
			<Sprite style="flex-grow: 1" loading />
			<Display style="height:78px" loading />
		</Panel>
		<Panel slot="right">
			<div class="right-container">
				<div id="species-evolution-chain">
					{#each Array.from({ length: 3 }) as _, number}
						<div class="previewContainer">
							<Number value={number + 1} />
							<Sprite loading style="height: 96px;" />
							<Display loading />
						</div>
					{/each}
				</div>
				<div class="lower">
					<div class="moveSelect">
						<Display style="height: 106px; flex-grow: 1; width: 10px;" loading />
						<div class="buttonContainer">
							<UpButton disabled />
							<DownButton disabled />
						</div>
					</div>
					<nav>
						<button class="link" disabled>previous</button>
						<button class="link" disabled>next </button>
					</nav>
				</div>
			</div>
		</Panel>
	</Container>
</div>

<style>
	.container {
		display: flex;
		flex-direction: row;
		justify-content: center;
	}

	#species-evolution-chain {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		gap: 15px;
	}

	.previewContainer {
		display: flex;
		flex-direction: column;
		width: 96px;
		width: 10px;
		flex-grow: 1;
	}

	.right-container {
		display: flex;
		flex-direction: column;
		gap: 30px;
		height: 100%;
	}

	.right-container .lower {
		display: flex;
		flex-direction: column;
		gap: 30px;
		height: 100%;
		flex-grow: 1;
		justify-content: space-between;
	}

	.moveSelect {
		display: flex;
		flex-direction: row;
		gap: 20px;
	}

	.buttonContainer {
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: space-around;
	}
</style>
