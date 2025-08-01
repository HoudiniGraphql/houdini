<script lang="ts">
	import { page, navigating } from '$app/stores'
	import { Icon, SEO, SearchInput, SearchDialog, searching } from '~/components'
	import { onMount } from 'svelte'
	import throttle from 'lodash/throttle.js'
	import { browser } from '$app/environment'
	import Toolbar from '~/components/Toolbar.svelte'
	import Logo from '~/components/Logo.svelte'
	import VersionNotice from '~/components/VersionNotice.svelte'

	export let title = ''
	export let link = ''
	export let description

	export let data

	// pull the values out of the loader and configure the toolbar
	$: ui_theme = browser
		? parseInt(document.cookie.match('(^|;)\\s*' + 'ui_theme' + '\\s*=\\s*([^;]+)')?.pop() || '0')
		: data?.ui_theme
	$: lang = browser
		? document.cookie.match('(^|;)\\s*' + 'lang' + '\\s*=\\s*([^;]+)')?.pop() || 'js'
		: data?.lang

	// the list of files we can render
	// @ts-ignore
	const categories = REPLACE_WITH_OUTLINE

	// @ts-ignore
	let categoryNames = Object.keys(categories)

	// some state to control the menu
	let menuOpen = false
	function toggleMenu() {
		menuOpen = !menuOpen
	}

	// we have to drive the current category off of state so that the responsive
	// layout can swap it around without relying on page transitions
	let currentCategory = $page.url.pathname.split('/')[1].toLowerCase()
	let currentSubCategory = null

	// when navigating, keep the current category in sync
	navigating.subscribe((nav) => {
		if (!nav) {
			return
		}
		menuOpen = false
	})

	// whenever the browser resizes above the thin breakpoint we need to
	// close the popup menu so there's no funky link/button mismatch
	onMount(() => {
		window.onresize = () => {
			// if the window is above the thin width
			if (window.innerWidth > 1000) {
				menuOpen = false
				currentCategory = $page.url.pathname.split('/')[1].toLowerCase()
			}
		}
	})

	// count the number of / in a string
	// This will remove top level categories from the list of files
	function countSlashes(str) {
		return (str.match(/\//g) || []).length
	}

	// show the files associated with the current category (ignoring the index)
	$: pages = categories[currentCategory]?.files ?? []
	$: index = pages.findIndex((file) => {
		return file.title === title
	})
	$: previous = pages[index]?.previous
	$: next = pages[index]?.next

	$: withoutIndex = pages.filter((c) => countSlashes(c.slug) !== 1)

	// when the searching state toggles on the browser, hide the body's scroll
	$: {
		if (browser && $searching) {
			document.body.style.overflowY = 'hidden'
		}

		if (browser && !$searching) {
			document.body.style.overflowY = 'auto'
		}
	}

	function highlightSubsection() {
		// reset the category
		let value = null

		const headers = document.getElementsByTagName('h2')
		// @ts-ignore
		for (const element of headers) {
			// the current category is the last element that's above the half
			// way point on the screen
			if (element.getBoundingClientRect().top > 3) {
				break
			}

			value = element.attributes.getNamedItem('id').value
		}

		// update the current subcategory
		currentSubCategory = value
	}

	// make sure the correct subsection is highlighted
	onMount(() => {
		highlightSubsection()

		// make sure we track the current category when scrolling
		window.onscroll = throttle(highlightSubsection, 250)
	})
</script>

<SEO {title} {description} />

<SearchDialog />

<VersionNotice />

<main>
	<aside class:open={menuOpen} class:blur={$searching}>
		<div class="aside-head">
			<h1>
				<buton
					aria-haspopup="true"
					aria-expanded={menuOpen}
					class="menu-icon"
					tabindex="0"
					on:click={toggleMenu}
				>
					{#if menuOpen}
						<Icon name="x" width="20px" stroke="var(--saturated)" />
					{:else}
						<Icon name="menu" width="20px" />
					{/if}
				</buton>
				<a href="/">
					<div style="display: flex; align-items: center; gap: 7px">
						<Logo size={30} color={ui_theme === 0 ? 'white' : 'black'} />
						<span class="logo-text">Houdini</span>
					</div>
				</a>
				<SearchInput id="nav-search-input" />
				<Toolbar bind:ui_theme bind:lang />
			</h1>
			<nav class:hidden={!menuOpen}>
				{#each categoryNames as category}
					<a
						href={categories[category].index.slug}
						class:current={currentCategory === category}
						data-sveltekit-preload-data="hover"
					>
						{categories[category].name}
					</a>
				{/each}
			</nav>
		</div>
		<SearchInput id="left-nav-search-input" />
		<div class:hidden={!menuOpen} role="list">
			{#each withoutIndex as file}
				<a
					class="nav"
					role="listitem"
					class:current={!currentSubCategory && $page.url.pathname.endsWith(file.slug)}
					href={file.slug}
					data-sveltekit-preload-data="hover">{file.title}</a
				>
				<!-- render the subcategories for the selected category  -->
				{#if $page.url.pathname.endsWith(file.slug)}
					<div role="group">
						{#each file.subcategories as subcat}
							<a
								href={`${file.slug}#${subcat.id}`}
								class="subcategory nav"
								class:current={currentSubCategory === subcat.id}
								role="listitem"
							>
								{subcat.text}
							</a>
						{/each}
					</div>
				{/if}
			{/each}
		</div>
	</aside>

	<div class="doc-gutter">
		<article id="doc-content" class:blur={$searching}>
			<slot />
		</article>
		<footer class:blur={$searching}>
			{#if previous}
				<a
					id="previous-page"
					class="pagination"
					href={previous.slug}
					data-sveltekit-preload-data="hover"
				>
					<Icon name="chevron-left" class="icon" width="20px" height="20px" />
					<div>
						<h4>Previous</h4>
						<p>
							{previous.title}
						</p>
					</div>
				</a>
			{:else}
				<div id="previous-page" />
			{/if}
			{#if next}
				<a id="next-page" class="pagination" href={next.slug} data-sveltekit-preload-data="hover">
					<Icon name="chevron-right" class="icon" width="20px" height="20px" />
					<div>
						<h4>Next</h4>
						<p>
							{next.title}
						</p>
					</div>
				</a>
			{:else}
				<div id="next-page" />
			{/if}
		</footer>
	</div>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		background: var(--hue);
		color: var(--contrast);
		min-height: 100vh;
	}

	aside {
		padding-top: 0px;
		padding-bottom: 4rem;
		padding-left: max(0px, env(safe-area-inset-left));
		padding-right: max(10px, calc(10px + env(safe-area-inset-right)));
		margin-right: 50px;
		width: 330px;
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		/* top: 0; */
		top: 18px; /* add some padding to stay clear of the version notice */
		position: fixed;
		background-color: var(--hue);
		z-index: 10;
		bottom: 0;
		overflow-y: auto;
	}

	:global(.menu-icon) {
		display: none;
		margin-top: -10px;
	}

	aside h1 {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
	}

	h1 {
		margin-left: 40px;
		flex-shrink: 0;
		padding-top: 1rem;
	}

	.aside-head {
		background: var(--hue);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	h1 {
		font-size: 30px;
		font-family: 'Hind', sans-serif;
		margin-top: 14px;
		margin-bottom: 14px;
		color: var(--contrast);
		height: 45px;
		gap: 20px;
	}

	a,
	a:visited {
		color: var(--contrast);
		text-decoration: none;
		cursor: pointer;
	}

	nav a {
		background: none;
		border: none;
		padding-bottom: 10px;
		color: var(--contrast);
		font-size: 18px;
		font-family: 'Hind', sans-serif;
		padding-left: 10px;
		padding-right: 10px;
		margin-right: 5px;
	}

	nav a {
		height: 20px;
	}

	/* magic 4 is to offset the button list */
	nav a:nth-child(4) {
		margin-left: 30px;
	}

	nav {
		height: 30px;
		border-bottom: 3px solid var(--discreet);
		display: flex;
		margin-bottom: 1.25rem;
		flex-shrink: 0;
		padding-left: 2.5rem;
	}

	nav a:hover {
		color: var(--saturated);
	}

	nav a.current {
		border-bottom: 3px solid var(--saturated);
	}

	a.nav {
		padding: 10px 0;
		font-size: 18px;
		line-height: 25px;
		font-family: 'Hind', sans-serif;
		margin-bottom: 5px;
		padding-left: 2.5rem;
		padding-right: 20px;

		display: block;
	}

	a.nav:hover {
		background: var(--discreet);
		border-top-right-radius: 10px;
		border-bottom-right-radius: 10px;
	}

	a.nav.subcategory {
		padding-bottom: 13px;
	}

	a.nav.subcategory::before {
		content: '•';
		margin-left: 10px;
		margin-right: 10px;
	}

	a.nav.subcategory {
		padding-left: 3.25rem;
	}

	a.nav.current {
		background: var(--discreet2);
		border-top-right-radius: 10px;
		border-bottom-right-radius: 10px;
	}

	nav > a {
		display: flex;
	}

	footer {
		display: flex;
		flex-direction: row;
		margin-bottom: 100px;
		height: 30px;
		justify-content: space-between;
		gap: 100px;
	}

	#next-page {
		flex-direction: row-reverse;
	}

	article {
		margin: auto;
	}

	footer {
		margin: 0 auto 100px auto;
	}

	article,
	footer {
		max-width: 850px;
		box-sizing: border-box;
		padding-left: env(safe-area-inset-left);
		padding-right: calc(100px + env(safe-area-inset-right));
	}

	.doc-gutter {
		margin-left: 380px;
	}

	article {
		display: flex;
		flex-direction: column;

		overflow-y: auto;
		padding-top: 30px;
		margin-bottom: 50px;
	}

	.pagination {
		display: flex;
		flex-direction: row;
		align-items: center;
		font-size: 18px;
		font-family: 'Hind', sans-serif;
		font-weight: 500;
		text-decoration: none;
		justify-content: center;
		color: var(--contrast);
		gap: 12px;
	}

	.pagination:hover {
		color: var(--saturated);
	}

	.pagination h4 {
		font-family: 'Hind', sans-serif;
		margin-bottom: 5px;
	}

	.pagination p {
		color: var(--saturated);
	}

	.blur {
		filter: blur(4px);
		-o-filter: blur(4px);
		-ms-filter: blur(4px);
		-moz-filter: blur(4px);
		-webkit-filter: blur(4px);
	}

	:global(#nav-search-input) {
		margin-top: -5px;
		display: none;
		width: 60%;
	}

	:global(#left-nav-search-input) {
		margin-bottom: 1rem;
		width: 80%;
	}

	.logo {
		margin-bottom: -4px;
	}

	@media (max-width: 1000px) {
		article,
		footer {
			padding-left: calc(30px + env(safe-area-inset-left));
			padding-right: calc(30px + env(safe-area-inset-right));
			padding-top: 20px;
			max-width: none;
		}

		.doc-gutter,
		footer {
			margin-left: 0px;
		}

		footer {
			margin-left: 0;
			width: 100%;
		}

		main {
			flex-direction: column;
		}

		aside {
			width: 100%;
			padding-top: 0;
			padding-bottom: 0;
			padding-left: max(0px, env(safe-area-inset-left));
			padding-right: max(0px, env(safe-area-inset-right));
			box-sizing: border-box;
			margin-right: 0px;
			position: sticky;
			overflow-y: unset;
		}

		.subcategory {
			display: none !important;
		}

		aside.open {
			height: 100%;
			position: fixed;
			overflow-x: hidden;
			overflow-y: auto;
			overscroll-behavior: contain;
		}

		h1 {
			margin-left: 20px;
			margin-right: 20px;
		}

		:global(.menu-icon) {
			display: flex;
			cursor: pointer;
		}

		.hidden {
			display: none;
		}

		nav {
			margin-bottom: 1rem;
		}

		a.current {
			border-top-right-radius: 0px !important;
			border-bottom-right-radius: 0px !important;
		}

		:global(#left-nav-search-input) {
			display: none;
		}

		:global(#nav-search-input) {
			display: flex;
		}

		.logo-text {
			display: none;
		}
	}

	@media (max-width: 450px) {
		article,
		footer {
			padding-left: calc(15px + env(safe-area-inset-left));
			padding-right: calc(15px + env(safe-area-inset-right));
		}
	}
</style>
