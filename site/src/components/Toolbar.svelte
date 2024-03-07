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
		{ label: 'light', icon: 'moon' },
		{ label: 'dark', icon: 'sun' }
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
			.code-title.example-typescript {
				display: flex;
			}
			.code-title.example-typescript + :is(pre.language-svelte, pre.language-typescript) {
				display: block;
			}
			.code-title.tsx {
				display: flex;
			}
			.code-title.jsx {
				display: none;
			}
			.code-title.example-javascript {
				display: none;
			}
			.code-title.example-javascript + :is(pre.language-svelte, pre.language-javascript) {
				display: none;
			}
			.language-tsx {
				display: block;
			}
			.language-jsx {
				display: none;
			}
		</style>
	{:else}
		<style>
			.code-title.example-typescript {
				display: none;
			}
			.code-title.example-typescript + :is(pre.language-svelte, pre.language-typescript) {
				display: none;
			}
			.code-title.example-javascript {
				display: flex;
			}
			.code-title.example-javascript + :is(pre.language-svelte, pre.language-javascript) {
				display: block;
			}
			.code-title.tsx {
				display: none;
			}
			.code-title.jsx {
				display: flex;
			}
			.language-tsx {
				display: none;
			}
			.language-jsx {
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
				--saturated: #ff3e00;
				--link-color: #ff5c26;
				--text-highlight: #3595ff;
				--text-highlight-background: #eee;

				--code-title-background: #0c0f14;
				--code-title-color: #475465;

				--zoom-shadow: #191c26;
				--caption-text: #828282;

				/* Scrollbar */
				--scrollbar-slider: #828487;
				--scrollbar-track: var(--discreet2);

				/* Notices */
				--deep-dive: #3269d9;
				--deep-dive-text: white;
				--deep-dive-background: var(--discreet);
				--graphql-explained: #cf2b99;
				--graphql-explained-background: var(--discreet);
				--warning: #f0aa48;
				--warning-text: white;
				--experimental-background: #79b04f;
				--experimental-text: var(--contrast);

				/* Diagram Colors */
				--diagram-line-color: #292f38;
				--diagram-canvas-color: var(--hue);
				--diagram-border-color: #a6cdf7;
				--diagram-background-color: #cfe6ff;
				--diagram-text-color: var(--contrast);
				--diagram-subgraph-color: #e6f0fc;
			}
		</style>
	{:else}
		<!-- dark mode -->
		<style>
			:root {
				--hue: #191c26;
				--contrast: #f9fbff;
				--discreet: #232938;
				--discreet2: #323b53;
				--saturated: #ff3e00;
				--link-color: #fc602d;
				--text-highlight: #a1c5f8;
				--text-highlight-background: #222832;

				--code-title-background: #0c0f14;
				--code-title-color: #475465;

				--zoom-shadow: black;
				--caption-text: #5d6994;

				/* Scrollbar */
				--scrollbar-slider: rgba(20, 21, 25, 1);
				--scrollbar-track: #272e38;

				/* Notices */
				--deep-dive: #17346d;
				--deep-dive-background: var(--discreet);
				--deep-dive-text: white;
				--graphql-explained: #8d005f;
				--graphql-explained-background: var(--discreet);
				--warning: #bc791b;
				--warning-text: white;
				--experimental-background: hsl(95, 38%, 62%);
				--experimental-text: var(--discreet);

				/* Diagram Colors */
				--diagram-line-color: var(--contrast);
				--diagram-canvas-color: var(--hue);
				--diagram-border-color: var(--contrast);
				--diagram-background-color: var(--discreet2);
				--diagram-text-color: var(--contrast);
				--diagram-subgraph-color: var(--discreet);
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
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="1em"
				height="1em"
				preserveAspectRatio="xMidYMid meet"
				viewBox="0 0 256 256"
			>
				<rect class="theme-button" x="0" width="256" height="256" rx="35" fill="currentcolor" />
				<path
					fill="var(--hue)"
					d="m67.312 213.932l19.59-11.856c3.78 6.701 7.218 12.371 15.465 12.371c7.905 0 12.89-3.092 12.89-15.12v-81.798h24.057v82.138c0 24.917-14.606 36.259-35.916 36.259c-19.245 0-30.416-9.967-36.087-21.996m85.07-2.576l19.588-11.341c5.157 8.421 11.859 14.607 23.715 14.607c9.969 0 16.325-4.984 16.325-11.858c0-8.248-6.53-11.17-17.528-15.98l-6.013-2.58c-17.357-7.387-28.87-16.667-28.87-36.257c0-18.044 13.747-31.792 35.228-31.792c15.294 0 26.292 5.328 34.196 19.247l-18.732 12.03c-4.125-7.389-8.591-10.31-15.465-10.31c-7.046 0-11.514 4.468-11.514 10.31c0 7.217 4.468 10.14 14.778 14.608l6.014 2.577c20.45 8.765 31.963 17.7 31.963 37.804c0 21.654-17.012 33.51-39.867 33.51c-22.339 0-36.774-10.654-43.819-24.574"
				/>
			</svg>
		{:else}
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="1em"
				height="1em"
				preserveAspectRatio="xMidYMid meet"
				viewBox="0 0 256 256"
			>
				<rect class="theme-button" x="0" width="256" height="256" rx="35" fill="currentcolor" />
				<path
					fill="var(--hue)"
					d="M150.518 200.475v27.62c4.492 2.302 9.805 4.028 15.938 5.179c6.133 1.151 12.597 1.726 19.393 1.726c6.622 0 12.914-.633 18.874-1.899c5.96-1.266 11.187-3.352 15.678-6.257c4.492-2.906 8.048-6.704 10.669-11.394c2.62-4.689 3.93-10.486 3.93-17.391c0-5.006-.749-9.394-2.246-13.163a30.748 30.748 0 0 0-6.479-10.055c-2.821-2.935-6.205-5.567-10.149-7.898c-3.945-2.33-8.394-4.531-13.347-6.602c-3.628-1.497-6.881-2.949-9.761-4.359c-2.879-1.41-5.327-2.848-7.342-4.316c-2.016-1.467-3.571-3.021-4.665-4.661c-1.094-1.64-1.641-3.495-1.641-5.567c0-1.899.489-3.61 1.468-5.135s2.362-2.834 4.147-3.927c1.785-1.094 3.973-1.942 6.565-2.547c2.591-.604 5.471-.906 8.638-.906c2.304 0 4.737.173 7.299.518c2.563.345 5.14.877 7.732 1.597a53.669 53.669 0 0 1 7.558 2.719a41.7 41.7 0 0 1 6.781 3.797v-25.807c-4.204-1.611-8.797-2.805-13.778-3.582c-4.981-.777-10.697-1.165-17.147-1.165c-6.565 0-12.784.705-18.658 2.115c-5.874 1.409-11.043 3.61-15.506 6.602c-4.463 2.993-7.99 6.805-10.582 11.437c-2.591 4.632-3.887 10.17-3.887 16.615c0 8.228 2.375 15.248 7.127 21.06c4.751 5.811 11.963 10.731 21.638 14.759a291.458 291.458 0 0 1 10.625 4.575c3.283 1.496 6.119 3.049 8.509 4.66c2.39 1.611 4.276 3.366 5.658 5.265c1.382 1.899 2.073 4.057 2.073 6.474a9.901 9.901 0 0 1-1.296 4.963c-.863 1.524-2.174 2.848-3.93 3.97c-1.756 1.122-3.945 1.999-6.565 2.632c-2.62.633-5.687.95-9.2.95c-5.989 0-11.92-1.05-17.794-3.151c-5.875-2.1-11.317-5.25-16.327-9.451Zm-46.036-68.733H140V109H41v22.742h35.345V233h28.137V131.742Z"
				/>
			</svg>
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
