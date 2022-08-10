<script>
	import { HighlightSvelte } from 'svelte-highlight'
	import { SEO, Icon } from '~/components'

	const heroExample = `<script>
    import { query, graphql } from '$houdini'

    const { data } = query(graphql\`
        query AllTodoItems {
            items {
                text
            }
        }
    \`)
<\/script>

{#each $data.items as item}
    <div>{item.text}</div>
{/each}
`

	const bullets = [
		'The same API for Kit, Sapper, or vanilla Svelte',
		'Normalized cache with declarative field updates and list mutations',
		'Colocate data requirements or define operations in external files with generated stores',
		'First-class support for advanced patterns like subscriptions and pagination'
	]
	// Server Side Rendering
	// First Contentful Paint
	const sellingPoints = [
		{
			header: 'Composable',
			text: 'Your components can define what data they need to do their job by and you can mix them together however you want.',
			example: `<script>
    import { query, graphql } from '$houdini'
    import { UserAvatar } from '~/components'

    const { data } = query(graphql\`
        query AllUsers {
            users {
                ...UserAvatar
            }
        }
    \`)
<\/script>

{#each $data.users as user}
    <UserAvatar {user} />
{/each}`
		},
		{
			header: 'Declarative',
			text: 'Updates to your application cache are made with a set of declarative fragments that avoid the surgical logic necessary to keep your application up to date.',
			example: `<script>
    import { mutation, graphql } from '$houdini'

    const createProject = mutation(graphql\`
            mutation CreateProject {
                createProject(name: "houdini") {
                    project {
                        ...All_Projects_insert
                    }
                }
            }
    \`)
<\/script>

<button onClick={createProject} />`
		},
		{
			header: 'Type Safe',
			text: 'Generate TypeScript definitions for every document in your application.',
			example: `<script lang="ts">
    import { query, graphql } from '$houdini'
    import type { AllTodoItems } from '$houdini'

    const { data } = query<AllTodoItems>(graphql\`
        query AllTodoItems {
            items {
                text
            }
        }
    \`)
<\/script>

{#each $data.items as item}
    <div>{item.text}</div>
{/each}
`
		}
	]

	// @ts-ignore
	const files = REPLACE_WITH_OUTLINE.inline
</script>

<svelte:head>
	<meta name="theme-color" content="white" />
</svelte:head>

<SEO />

<a id="skip-nav" href="#main"> Skip to Content </a>

<header class="content">
	<a href="/">
		<img src="/images/logo.svg" alt="Houdini Logo" width="175px" />
	</a>
	<nav>
		<a href={files.intro.index.slug} class="nav-link" sveltekit:prefetch>Get Started</a>
		<a href={files.guides.index.slug} class="nav-link small-hidden" sveltekit:prefetch>Guides</a>
		<a href={files.api.index.slug} class="nav-link small-hidden" sveltekit:prefetch>API</a>
		<a href="https://opencollective.com/houdini" class="nav-link small-hidden" target="_blank">
			Sponsor
		</a>
		<a
			href="https://www.github.com/HoudiniGraphQL/houdini"
			class="tiny-hidden"
			target="_blank"
			id="gh-link"
		>
			<img src="/images/github.svg" alt="Github" height="20px" />
		</a>
	</nav>
</header>
<main id="main">
	<section id="hero" class="content">
		<div>
			<h1>
				The disappearing <span id="graphql-text">GraphQL</span>
				client for the <span class="svelte-text">Svelte</span> community.
			</h1>
			<ul>
				{#each bullets as bullet}
					<li>{bullet}</li>
				{/each}
			</ul>
			<nav id="hero-buttons">
				<a href="/intro/welcome" class="button-shadow" sveltekit:prefetch>Get Started</a>
			</nav>
		</div>
		<div>
			<HighlightSvelte code={heroExample} class="shadow" />
		</div>
	</section>
	<div class="tease">
		<Icon name="chevron-down" width="3rem" height="3rem" />
	</div>
	<section id="info">
		<div id="angle" />
		<article>
			<div id="showcase" class="content">
				{#each sellingPoints as point}
					<div class="showcase-item">
						<div class="showcase-text">
							<h2>{point.header}</h2>
							<p>
								{point.text}
							</p>
						</div>
						<HighlightSvelte code={point.example} class="showcase-example" />
					</div>
				{/each}
			</div>
		</article>
	</section>
</main>

<style>
	:global(body) {
		background-color: #f9fbff;
		display: flex;
		flex-direction: column;
	}

	:global(#hero pre) {
		background: #161b22;
		border-radius: 32px;
		color: white;
	}

	:global(.shadow) {
		box-shadow: 10px 12px 25px 3px rgba(23, 40, 102, 0.25);
	}

	main {
		flex-grow: 1;
		display: flex;
		flex-direction: column;
	}

	#skip-nav {
		border: 0;
		clip: rect(0 0 0 0);
		height: 1px;
		width: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		position: absolute;
	}

	#skip-nav:focus {
		padding: 1rem;
		position: fixed;
		top: 10px;
		left: 10px;
		background: white;
		z-index: 1;
		width: auto;
		height: auto;
		clip: auto;
	}

	.tease {
		align-self: center;
		margin-top: 150px;
	}

	header {
		height: 100px;
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		box-sizing: border-box;
	}

	.nav-link {
		font-size: 1rem;
		font-family: 'Hind', sans-serif;
		color: #161b22;
		text-decoration: none;
		font-weight: bold;
	}

	.nav-link:hover {
		padding-bottom: 4px;
		border-bottom: 4px solid #ff3e00;
		margin-bottom: -8px;
	}

	nav {
		display: flex;
		flex-direction: row;
		align-items: center;
		margin-top: 15px;
	}

	.content {
		max-width: 1300px;
		margin: 0 auto;
		width: 100%;
	}

	.content nav {
		gap: 1.5rem;
	}

	#hero {
		display: flex;
		flex-direction: row;
		margin-top: 90px;
	}

	#hero div:first-child {
		width: 10px;
		flex-grow: 1;
		margin-top: 24px;
		display: flex;
		flex-direction: column;
		gap: 3.25rem;
	}

	#hero div:last-child {
		width: 10px;
		flex-grow: 1;
		margin-top: 24px;
		display: flex;
		flex-direction: column;
		margin-left: 4rem;
	}

	#hero h1 {
		flex-grow: 1;
		font-size: 40px;
		font-weight: bold;
		line-height: 3.25rem;
		color: #161b22;
		text-align: center;
	}

	h1,
	h2 {
		font-family: 'Crete Round', serif;
	}

	#graphql-text {
		color: #e10098;
	}

	.svelte-text {
		color: #ff3e00;
	}

	.button-shadow {
		box-shadow: 1px 2px 25px 3px rgba(23, 40, 102, 0.1);
	}

	#info {
		display: flex;
		flex-direction: column;
		margin-top: 3rem;
		flex-grow: 1;
	}

	#angle {
		width: 100%;
		height: 100px;
		background: #161b22;
		clip-path: polygon(-1% 101%, 100% 0%, 100% 101%);
	}

	article {
		flex-grow: 1;
		background: #161b22;
		padding-top: 11.5rem;
	}
	ul {
		width: 70%;
		margin: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 455px;
	}

	li {
		font-family: 'Hind', sans-serif;
		font-size: 20px;
		line-height: 1.25;
		position: relative;
	}

	li::before {
		content: ' ';
		width: 12px;
		height: 12px;
		font-size: 32px;
		line-height: 20px;
		background: #ff3e00;
		border-radius: 50%;
		margin-left: -30px;
		margin-right: 10px;
		display: inline-block;
		margin-top: -3px;
		position: absolute;
		right: calc(100%);
		top: 9px;
	}

	#hero-buttons {
		display: flex;
		flex-direction: row;
		gap: 36px;
		justify-content: center;
	}

	#hero-buttons a {
		height: 3rem;
		width: 10.75rem;

		font-family: 'Hind', sans;
		font-weight: bold;
		color: white;
		background-color: #ff3e00;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		font-size: 1.2rem;
		text-decoration: none;
	}

	#showcase {
		display: grid;
		width: 100%;
		margin-bottom: 100px;
	}

	.showcase-item {
		display: flex;
		flex-direction: row;
		margin-bottom: 160px;
	}

	h2 {
		color: white;
		font-size: 2rem;
		margin-bottom: 1.25rem;
	}

	p {
		font-family: 'Hind', sans-serif;
		color: white;
		font-size: 1.4rem;
		line-height: 1.3;
		margin-right: 35px;
	}

	.showcase-text {
		width: 10px;
		flex-grow: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		margin-right: 2.5rem;
	}

	:global(.showcase-example) {
		width: 10px;
		flex-grow: 1;
		font-size: 18px;
		font-family: 'Roboto Mono', monospace;

		margin-left: 4rem;
	}

	:global(#main pre) {
		overflow: hidden;
	}

	:global(#hero code) {
		padding: 34px;
	}

	@media (max-width: 1450px) {
		h1 {
			padding: 0 40px;
			margin-left: 0px !important;
			margin-right: 0px !important;
			box-sizing: border-box;
			text-align: center;
			width: 100%;
		}

		#hero-buttons {
			justify-content: center;
		}

		header {
			padding: 0 30px;
			padding: 0 calc(env(safe-area-inset-right) + 60px) 0 calc(env(safe-area-inset-left) + 60px);
		}

		:global(.showcase-item pre),
		:global(#hero pre) {
			margin-right: calc(env(safe-area-inset-right) + 60px);
		}

		.showcase-text {
			margin-left: calc(env(safe-area-inset-left) + 60px);
		}

		:global(.showcase-example) {
			margin-bottom: 30px;
		}

		:global(code) {
			font-size: 15px;
		}
	}

	@media (max-width: 1000px) {
		h1 {
			font-weight: 400 !important;
		}
		h2 {
			font-size: 32px;
		}

		p {
			font-size: 20px;
			margin-right: 0;
		}

		article {
			padding-top: 2rem;
		}

		#hero-buttons {
			align-self: center;
		}

		.showcase-item:first-child {
			margin-top: 100px;
		}

		.showcase-item {
			flex-direction: column;
			width: 100%;
			overflow-x: hidden;
		}

		.showcase-text {
			width: 100%;
			align-self: center;
			padding: 0 10%;
			margin-right: 0;
			margin-left: 0;
			box-sizing: border-box;
		}

		:global(.showcase-example) {
			margin-top: 30px;
			width: 100%;
			align-self: center;
			margin-right: 0;
			padding: 0 10%;
			box-sizing: border-box;
		}

		#hero {
			flex-direction: column;
			width: 100%;
		}

		#hero div:first-child {
			align-self: center;
			width: 90%;
			display: flex;
			flex-direction: column;
			align-items: center;
		}

		#hero div:last-child {
			align-self: center;
			width: 100%;
			margin-top: 50px;
			margin-right: 0;
			margin-left: 0;
		}

		:global(#hero pre) {
			margin: auto;
			width: 70%;
		}

		:global(code) {
			font-size: 18px;
			overflow-x: auto;
		}

		#hero {
			margin-top: 30px !important;
		}

		#hero div:first-child {
			margin-bottom: 40px;
		}
	}

	@media (max-width: 790px) {
		:global(#hero pre) {
			width: 80%;
			box-sizing: border-box;
		}
	}
	@media (max-width: 650px) {
		:global(#hero pre) {
			width: 95%;
		}
	}

	@media (max-width: 580px) {
		h1 {
			padding: 0 30px;
		}

		.small-hidden {
			display: none;
		}

		.nav-link {
			margin-left: 20px;
		}

		:global(#hero pre) {
			box-sizing: border-box;
		}
	}

	@media (max-width: 450px) {
		.tiny-hidden {
			display: none;
		}

		#hero-buttons {
			flex-direction: column;
		}
		header,
		:global(#main pre) {
			padding-left: calc(10% + env(safe-area-inset-left));
			padding-right: calc(10% + env(safe-area-inset-right));
		}

		.showcase-item {
			margin-bottom: 75px;
		}

		.showcase-text {
			padding: 0 30px;
		}

		article {
			padding-top: 1rem;
		}

		#info {
			margin-top: 6rem;
		}
	}

	@media (max-width: 400px) {
		.micro-hidden {
			display: none;
		}
	}
</style>
