<script>
	import feather from 'feather-icons'
	export const directions = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
	export let name
	export let direction = 'n'
	export let strokeWidth = undefined
	export let stroke = undefined
	export let width = '1em'
	export let height = '1em'

	$: icon = feather.icons[name]
	$: rotation = directions.indexOf(direction) * 45
	$: if (icon) {
		if (stroke) icon.attrs['stroke'] = stroke
		if (strokeWidth) icon.attrs['stroke-width'] = strokeWidth
	}
</script>

{#if icon}
	<svg
		{...icon.attrs}
		style="width: {width}; height: {height}; transform: rotate({rotation}deg);"
		class={$$props.class}
	>
		<g>
			{@html icon.contents}
		</g>
	</svg>
{/if}

<style>
	svg {
		width: 1em;
		height: 1em;
		overflow: visible;
		transform-origin: 50% 50%;
	}
</style>
