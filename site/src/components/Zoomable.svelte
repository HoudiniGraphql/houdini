<script>
	import { scale, fade } from 'svelte/transition'
	import { clickOutside } from './clickOutside.js'

	export let style = ''

	let zoomed = false
	let canWeZoom = true

	function on_key_up(event) {
		switch (event.key) {
			case 'Escape':
				zoomed = false
				event.preventDefault()
				break
		}
	}

	function handleClickOutside(event) {
		canWeZoom = false
		zoomed = false
		setTimeout(() => {
			canWeZoom = true
		}, 300)
	}
</script>

<svelte:window on:keyup={on_key_up} />

<div
	class="zoomable"
	{style}
	on:click={() => {
		if (canWeZoom) {
			zoomed = !zoomed
		}
	}}
>
	<slot />
	<span class="info-zoom">
		<!-- Zoom int -->
		<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
			><path
				fill="currentColor"
				d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14z"
			/><path fill="currentColor" d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z" /></svg
		>
	</span>
</div>
{#if zoomed}
	<div transition:fade class="background" />
	<div transition:scale use:clickOutside on:click_outside={handleClickOutside} class="zoomed">
		<div class="content">
			<slot />
			<span
				on:click={() => {
					zoomed = false
				}}
				class="info-zoom"
			>
				<!-- Zoom out -->
				<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"
					><path
						fill="currentColor"
						d="m18.9 20.3l-5.6-5.6q-.75.6-1.725.95Q10.6 16 9.5 16q-2.725 0-4.612-1.887Q3 12.225 3 9.5q0-2.725 1.888-4.613Q6.775 3 9.5 3t4.613 1.887Q16 6.775 16 9.5q0 1.1-.35 2.075q-.35.975-.95 1.725l5.625 5.625q.275.275.263.687q-.013.413-.288.688q-.275.275-.7.275q-.425 0-.7-.275ZM9.5 14q1.875 0 3.188-1.312Q14 11.375 14 9.5q0-1.875-1.312-3.188Q11.375 5 9.5 5Q7.625 5 6.312 6.312Q5 7.625 5 9.5q0 1.875 1.312 3.188Q7.625 14 9.5 14Zm-1.525-3.5q-.425 0-.7-.288Q7 9.925 7 9.5t.287-.713Q7.575 8.5 8 8.5h3.025q.425 0 .7.287q.275.288.275.713t-.287.712q-.288.288-.713.288Z"
					/></svg
				>
			</span>
		</div>
	</div>
{/if}

<style>
	.zoomable {
		position: relative;
		cursor: pointer;
	}

	.info-zoom {
		position: absolute;
		bottom: 1rem;
		right: 1rem;
		cursor: pointer;
	}

	.background {
		position: fixed;
		background-color: var(--hue);
		opacity: 0.8;
		top: 0;
		left: 0;
		z-index: 99;
		width: 100%;
		height: 100%;
	}

	.zoomed {
		position: fixed;
		z-index: 100;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 96%;
	}

	.content {
		padding: 1rem;
		border: 1px solid var(--zoom-shadow);
		border-radius: 1rem;
		background-color: var(--hue);
		box-shadow: 0.5rem 0.5rem 2rem var(--zoom-shadow);
	}
</style>
