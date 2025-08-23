<script>
	import { browser } from '$app/environment'
	import Logo from '~/components/Logo.svelte'

	export let data

	$: ui_theme = browser
		? parseInt(document.cookie.match('(^|;)\\s*' + 'ui_theme' + '\\s*=\\s*([^;]+)')?.pop() || '0')
		: data?.ui_theme
</script>

<a href="/">
	<div style="margin: 14px">
		<div style="display: flex; align-items: center; gap: 7px">
			<Logo size={30} color={ui_theme === 0 ? 'white' : 'black'} />
			<span class="logo-text">Houdini</span>
		</div>
	</div>
</a>

{@html data.svg}

<style>
	.logo-text {
		color: white;
		font-size: 22px;
		font-family: 'Hind', sans-serif;
		font-weight: 600;
	}

	a {
		text-decoration: none;
	}
</style>
