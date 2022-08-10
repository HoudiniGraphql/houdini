<script>
	import { page, navigating, session } from '$app/stores'
	import { Icon, SEO, SearchInput, SearchDialog, searching } from '~/components'
	import { onMount } from 'svelte'
	import throttle from 'lodash/throttle.js'
	import { browser } from '$app/env'
	import mode from '~/lib/mode'

	export let title = ''
	export let link = ''
	export let index
	export let description

	// the list of files we can render
	// @ts-ignore
	const outline = REPLACE_WITH_OUTLINE

	let categories = outline[$mode]
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

	// show the files associated with the current category
	$: currentFiles = categories[currentCategory]?.files || []
	$: previous = currentFiles[index]?.previous
	$: next = currentFiles[index]?.next

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

		/** @type { HTMLHeadingElement[] }*/
		// @ts-ignore
		const headers = document.getElementsByTagName('h2')
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

<svelte:head>
	<meta name="theme-color" content="#161b22" />
</svelte:head>

<SEO {title} url={`https://www.houdinigraphql.com${link}`} {description} />

<SearchDialog />

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
						<Icon name="x" width="20px" stroke="#ff3e00" />
					{:else}
						<Icon name="menu" width="20px" />
					{/if}
				</buton>
				<a href="/">Houdini</a>
				<SearchInput id="nav-search-input" />
			</h1>
			<nav class:hidden={!menuOpen}>
				{#each categoryNames as category}
					<button
						on:click={() => (currentCategory = category)}
						class:current={currentCategory === category}
						aria-hidden
					>
						{categories[category].name}
					</button>
				{/each}
				{#each categoryNames as category}
					<a
						href={categories[category].index.slug}
						class:current={currentCategory === category}
						sveltekit:prefetch
					>
						{categories[category].name}
					</a>
				{/each}
			</nav>
		</div>
		<SearchInput id="left-nav-search-input" />
		<div class:hidden={!menuOpen} role="list">
			{#each currentFiles as file}
				<a
					class="nav"
					role="listitem"
					class:current={!currentSubCategory && $page.url.pathname.endsWith(file.slug)}
					href={file.slug}
					sveltekit:prefetch>{file.title}</a
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
				<a id="previous-page" class="pagination" href={previous.slug} sveltekit:prefetch>
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
				<a id="next-page" class="pagination" href={next.slug} sveltekit:prefetch>
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
		background: #161b22;
		color: white;
		min-height: 100vh;
	}

	aside {
		padding-top: 0px;
		padding-bottom: 4rem;
		padding-left: max(0px, env(safe-area-inset-left));
		padding-right: max(10px, calc(10px + env(safe-area-inset-right)));
		margin-right: 50px;
		width: 300px;
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		top: 0;
		position: fixed;
		background-color: #161b22;
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
	}

	h1 {
		margin-left: 40px;
		flex-shrink: 0;
		padding-top: 1rem;
	}

	.aside-head {
		position: sticky;
		top: 0;
		background: #161b22;
	}

	nav button:nth-child(1) {
		margin-left: 30px;
	}

	h1 {
		font-size: 30px;
		font-family: 'Hind', sans-serif;
		margin-top: 14px;
		margin-bottom: 14px;
		color: white;
		height: 45px;
		gap: 20px;
	}

	a,
	a:visited {
		color: white;
		text-decoration: none;
		cursor: pointer;
	}

	nav a,
	nav button {
		background: none;
		border: none;
		padding-bottom: 10px;
		color: white;
		font-size: 18px;
		font-family: 'Hind', sans-serif;
		padding-left: 10px;
		padding-right: 10px;
		margin-right: 5px;
	}

	nav button {
		height: 32px;
		cursor: pointer;
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
		border-bottom: 3px solid #303a48;
		display: flex;
		margin-bottom: 1.25rem;
		flex-shrink: 0;
	}

	nav a:hover,
	nav button:hover {
		color: #ff3e00;
	}

	nav a.current,
	nav button.current {
		border-bottom: 3px solid #ff3e00;
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
		background: #28303a;
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
		background: #475465;
		border-top-right-radius: 10px;
		border-bottom-right-radius: 10px;
	}

	nav > button {
		display: none;
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
		margin-left: 350px;
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
		color: white;
		gap: 12px;
	}

	.pagination:hover {
		color: #ff3e00;
	}

	.pagination h4 {
		font-family: 'Hind', sans-serif;
		margin-bottom: 5px;
	}

	.pagination p {
		color: #ff3e00;
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

	@media (max-width: 1000px) {
		article,
		footer {
			padding-left: calc(55px + env(safe-area-inset-left));
			padding-right: calc(55px + env(safe-area-inset-right));
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
		}

		.subcategory {
			display: none !important;
		}

		aside.open {
			height: 100%;
			position: fixed;
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

		nav > a {
			display: none;
		}

		nav > button {
			display: flex;
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
	}

	@media (max-width: 450px) {
		article,
		footer {
			padding-left: calc(30px + env(safe-area-inset-left));
			padding-right: calc(30px + env(safe-area-inset-right));
		}
	}
</style>
