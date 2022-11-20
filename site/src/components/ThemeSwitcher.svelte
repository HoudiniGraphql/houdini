<script>
	import { Icon } from '~/components'

	export let ui_theme

	const themes = {
		dark: {
			label: 'Dark',
			icon: 'moon'
		},
		light: {
			label: 'Light',
			icon: 'sun'
		}
		// os: {
		// 	label: 'OS&nbsp;Default',
		// 	icon: '?'
		// }
	}

	let menuOpen = false

	const toggleMenu = () => (menuOpen = !menuOpen)

	const setTheme = (themeName) => {
		ui_theme = themeName
		menuOpen = false
	}
</script>

<div class="theme-switcher">
	<button
		aria-haspopup="menu"
		type="button"
		aria-expanded={menuOpen}
		class="menu"
		class:opened={menuOpen}
		on:click={toggleMenu}
	>
		<Icon name={themes[ui_theme].icon} />
	</button>

	<ul aria-labelledby="themes-menu-button" class:hidden={!menuOpen}>
		{#each Object.keys(themes) as theme_name}
			{@const theme = themes[theme_name]}
			<li class:active={theme_name === ui_theme}>
				<button type="button" on:click={() => setTheme(theme_name)}>
					<span class="content">
						<Icon name={theme.icon} />
						<span class="label">{theme.label}</span>
					</span>
				</button>
			</li>
		{/each}
	</ul>
</div>

<style>
	.theme-switcher {
		margin-left: auto;
		position: relative;
		z-index: 8888;
	}

	button.menu {
		background: var(--hue);
		color: var(--contrast);
		font-size: 17px;
		cursor: pointer;
		border: 0px solid var(--discreet);
		opacity: 0.6;
		padding: 5px;
		padding-right: 0;
	}

	button.menu.opened,
	button.menu:hover {
		color: var(--saturated);
	}

	ul {
		border-radius: 9px;
		padding: 12px 18px;
		background: var(--discreet);
		position: absolute;
		top: 100%;
		right: 0%;
		z-index: 1;
	}

	ul.hidden {
		display: none;
	}

	ul li button {
		border-radius: 6px;
		opacity: 0.9;
		color: var(--contrast);
		background: var(--hue);
		border: 1px solid var(--discreet);
		cursor: pointer;
		padding: 6px 12px;
		margin: 6px 0;
	}

	li.active button {
		background: var(--hue);
		border: 1px solid var(--saturated);
	}

	li button:hover {
		border: 1px solid var(--discreet);
		background: var(--saturated);
		color: var(--hue);
		opacity: 1;
	}

	ul button .content {
		display: flex;
		align-items: center;
		flex-direction: row;
	}

	ul button .content .label {
		margin-left: 9px;
		margin-bottom: 1px;
	}
</style>
