<script>
	import { OgCard } from '~/components'
</script>

<div class="content">
	<span class="top-text"
		>Hooo, we are sorry to find you here!
		<br />
		<br />
		👉 <a href="/">Go back Home</a> 👈
	</span>
	<OgCard subTitle="404!" />
</div>

<style>
	:root {
		background: #20283d;
	}

	.content {
		font-family: 'Hind';
		display: flex;
		flex-direction: column;
		justify-content: left;
		align-items: flex-start;
		height: 100vh;
		width: 100vw;
	}

	.top-text {
		margin: auto;
		text-align: center;
		font-size: xx-large;
		color: white;
	}

	a {
		color: white;
	}
</style>
