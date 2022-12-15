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
		document.cookie = `ui_theme=${theme};path=/;SameSite=Lax`
	}
</script>

<svelte:head>
	<meta name="theme-color" content="#161b22" />

	{#if ui_theme === 1}
		<!-- light mode -->
		<style>
			:root {
				--hue: #f9fbff;
				--contrast: #161b22;
				--discreet: #ebeef5;
				--discreet2: #d3d6dc;
				--scrollbar-slider: #828487;
				--scrollbar-track: var(--discreet2);
				--saturated: #ff3e00;
				--graphql-explained: #cf2b99;
				--graphql-explained-background: var(--discreet);
				--deep-dive: #214a9c;
				--deep-dive-text: white;
				--deep-dive-background: var(--discreet);
				--link-color: #FF5C26;
				--text_highlight: #3595FF;
				--text_highlight_background: #eee;
			}
		</style>
	{:else}
		<!-- dark mode -->
		<style>
			:root {
				--hue: #161b22;
				--contrast: #f9fbff;
				--discreet: #303a48;
				--discreet2: #475465;
				--scrollbar-slider: #101318;
				--scrollbar-track: #272e38;
				--saturated: #ff3e00;
				--deep-dive: #17346d;
				--deep-dive-background: var(--discreet);
				--deep-dive-text: white;
				--graphql-explained: #8d005f;
				--graphql-explained-background: var(--discreet);
				--link-color: #fc602d;
				--text_highlight: #a1c5f8;
				--text_highlight_background: #222832;
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
