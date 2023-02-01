<script>
	import { page } from '$app/stores'
	import { Logo, OgCard } from '~/components'
	import { QSLink } from '~/lib/QSLink'

	let subTitle = QSLink(page, 'sub')
	let style = QSLink(page, 'style')

	$: nicer = $style !== 'for_ci'
</script>

<div class={nicer ? 'content-nice' : 'content'}>
	<OgCard {nicer} subTitle={$subTitle} />

	<div>
		<input type="text" bind:value={$subTitle} placeholder="Sub Title" />
		<select bind:value={$style}>
			<option value="for_ci">For CI</option>
			<option value={null}>Styled</option>
		</select>
	</div>
</div>

<style>
	input {
		margin-bottom: 2rem;
		font-size: xx-large;
		font-size: 24px;
	}

	select {
		margin-bottom: 2rem;
		font-size: xx-large;
		font-size: 24px;
	}

	.content {
		display: flex;
		flex-direction: column;
		justify-content: left;
		align-items: flex-start;
		height: 100vh;
		width: 100vw;
		background: white;
	}

	.content-nice {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 100vh;
		width: 100vw;
		background: #f2f2f2;
	}
</style>
