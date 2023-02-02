<script>
	import { Logo } from '~/components'

	export let nicer = true
	export let subTitle = ''
</script>

<div id="og-card" style={nicer ? '' : 'margin-left: 0; margin-top: 0; border-radius: 0'}>
	<div class="layer-0">
		<div style="width: 300px;" />
		<img id="code" src="/images/_og/code_01.png" alt="code in the background" />
	</div>
	<div class="layer-1">
		<Logo />

		<div>
			<div id="title">Houdini</div>
			<div id="subTitle">{subTitle ?? ''}</div>
		</div>
	</div>
</div>

<style>
	* {
		/* Colors  */
		--background-color-1: #20283d;
		--background-color-2: rgba(20, 21, 25, 1);
		--highlight: #855aff;
		/* To have a nice image of 630px, I have to have here 650! */
		--card-height: 630px;
	}

	.layer-0 {
		position: absolute;
		display: flex;
		width: 1200px;
		height: var(--card-height);
		justify-content: center;
		gap: 50px;
	}

	.layer-1 {
		position: absolute;
		display: flex;
		width: 1200px;
		height: var(--card-height);
		justify-content: center;
		align-items: center;
		gap: 100px;
	}

	#code {
		margin-top: -50px;
		/* padding-bottom: 75px; */
		-webkit-mask-image: -webkit-gradient(
			linear,
			left top,
			left bottom,
			from(rgba(0, 0, 0, 0)),
			to(rgba(0, 0, 0, 0.25))
		);
		mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1), rgba(0, 0, 0, 0));
		/* opacity: 20%; */
		transform: perspective(1000px) rotateX(20deg) rotateY(-16deg) rotateZ(10deg);
		box-shadow: 24px 16px 64px 0 rgba(0, 0, 0, 0.08);
		border-radius: 2px;
	}

	/* #logo-head:hover {
		transform: translate3d(0, -1.5px, 0);
		transition-timing-function: ease-in-out;
		transition-duration: 500ms;
	} */

	#title {
		font-family: 'Hind';
		font-weight: 400;
		font-size: 150px;
		color: #fff;
		padding-right: 100px;
	}

	#subTitle {
		font-family: 'Hind';
		font-weight: 500;
		font-size: 80px;
		color: var(--highlight);
		/* The perfect value! */
		width: 604px;
	}

	#og-card {
		margin: auto;
		width: 1200px;
		height: var(--card-height);
		background: var(--background-color-1);
		background: linear-gradient(
			180deg,
			var(--background-color-1) 0%,
			var(--background-color-2) 900px
		);
		border-radius: 10px;
		box-shadow: 0 0 1px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.1);
	}
</style>
