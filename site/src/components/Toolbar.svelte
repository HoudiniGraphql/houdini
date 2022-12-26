<script>
	import { Icon } from '~/components'

	export let ui_theme = 0
	export let lang = 'js'
	$: other_lang = lang === 'js' ? 'ts' : 'js'
	const full_name = {
		js: 'javascript',
		ts: 'typescript'
	}

	const themes = [
		{ label: 'light', icon: 'sun' },
		{ label: 'dark', icon: 'moon' }
	]

	function setLang() {
		document.cookie = `lang=${other_lang};path=/;SameSite=Lax`
		lang = other_lang
	}

	function setTheme() {
		ui_theme = ui_theme ? 0 : 1
		document.cookie = `ui_theme=${ui_theme};path=/;SameSite=Lax`
	}
</script>

<svelte:head>
	<meta name="theme-color" content="#161b22" />

	{#if lang === 'ts'}
		<style>
			pre.language-javascript {
				display: none;
			}

			.code-title.javascript {
				display: none;
			}
			pre.language-typescript {
				display: block;
			}
			.code-title.typescript {
				display: flex;
			}

			.code-title.example-typescript {
				display: flex;
			}
			.code-title.example-typescript + pre.language-svelte {
				display: block;
			}
			.code-title.example-javascript {
				display: none;
			}
			.code-title.example-javascript + pre.language-svelte {
				display: none;
			}
		</style>
	{:else}
		<style>
			pre.language-javascript {
				display: block;
			}

			.code-title.javascript {
				display: flex;
			}
			pre.language-typescript {
				display: none;
			}
			.code-title.typescript {
				display: none;
			}

			.code-title.example-typescript {
				display: none;
			}
			.code-title.example-typescript + pre.language-svelte {
				display: none;
			}
			.code-title.example-javascript {
				display: flex;
			}
			.code-title.example-javascript + pre.language-svelte {
				display: block;
			}
		</style>
	{/if}

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
				--link-color: #ff5c26;
				--text-highlight: #3595ff;
				--text-highlight-background: #eee;
				--code-title-background: #0c0f14;
				--code-title-color: #475465;
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
				--text-highlight: #a1c5f8;
				--text-highlight-background: #222832;
				--code-title-background: #0c0f14;
				--code-title-color: #475465;
			}
		</style>
	{/if}
</svelte:head>

<div class="theme-switcher">
	<button
		type="button"
		title={`Change code examples to ${full_name[other_lang]}`}
		on:click={setLang}
	>
		{#if lang === 'js'}
			<img src="/images/ts-logo.png" height="18px" />
		{:else}
			<img src="/images/js-logo.png" height="18px" />
		{/if}
	</button>
	<button
		type="button"
		class="theme-button"
		title={`Switch to ${themes[ui_theme].label} theme`}
		on:click={setTheme}
	>
		<Icon name={themes[ui_theme].icon} />
	</button>
</div>

<style>
	.theme-switcher {
		position: relative;
		display: flex;
		flex-direction: row;
		justify-content: flex-end;
	}

	img {
		border-radius: 2px;
	}

	button {
		background: var(--hue);
		color: var(--contrast);
		font-size: 17px;
		cursor: pointer;
		border: 0px solid var(--discreet);
	}

	.theme-button {
		opacity: 0.6;
	}

	button:hover {
		color: var(--saturated);
	}
</style>
