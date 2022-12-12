<script>
	import { Icon } from '~/components'

	export let ui_theme = 0

	const themes = [
		{ label: 'light', icon: 'sun' },
		{ label: 'dark', icon: 'moon' }
	]

	const setTheme = () => {
		const theme = ui_theme ? 0 : 1
		ui_theme = theme
		document.cookie = `ui_theme=${theme};path=/;SameSite=Strict`
	}
</script>

<svelte:head>
	<meta name="theme-color" content="#161b22" />

	{#if ui_theme === 1}
		<style>
			:root {
				--hue: #f9fbff;
				--contrast: #161b22;
				--discreet: #ebeef5;
				--discreet2: #d3d6dc;
				--saturated: #ff3e00;
				--external: #8d005f;
				--text_highlight: hsl(207, 82%, 66%);
			}
		</style>
	{:else}
		<style>
			:root {
				--hue: #161b22;
				--contrast: #f9fbff;
				--discreet: #303a48;
				--discreet2: #475465;
				--saturated: #ff3e00;
				--external: #8d005f;
				--text_highlight: #a1c5f8;
			}
		</style>
	{/if}
</svelte:head>

<div class="theme-switcher">
	<button type="button" title={`Switch to ${themes[ui_theme].label} theme`} on:click={setTheme}>
		<Icon name={themes[ui_theme].icon} />
	</button>
</div>

<style>
	.theme-switcher {
		margin-left: auto;
		position: relative;
	}

	button {
		background: var(--hue);
		color: var(--contrast);
		font-size: 17px;
		cursor: pointer;
		border: 0px solid var(--discreet);
		opacity: 0.6;
		padding: 5px;
		padding-right: 0;
	}

	button:hover {
		color: var(--saturated);
	}
</style>
