<script>
	import { SEO, Emoji } from '~/components'
	import CodeSample from './CodeSample.svelte'
	import Block from './Block.svelte'
	import Logos from './Logos.svelte'
	import Logo from '~/components/Logo.svelte'
</script>

<SEO />

<a id="skip-nav" href="#main"> Skip to Content </a>

<article>
	<header>
		<div class="logo">
			<div style="display: flex; align-items: center; gap: 7px">
				<Logo size={30} />
				<span class="logo-text">Houdini</span>
			</div>
		</div>
		<nav>
			<a data-sveltekit-preload-data href="/intro">Get Started</a>
			<a data-sveltekit-preload-data href="/guides" class="hide-thin">Guides</a>
			<a data-sveltekit-preload-data href="/api" class="hide-thinner">API Docs</a>
			<a
				data-sveltekit-preload-data
				href="https://github.com/sponsors/HoudiniGraphql"
				target="_blank"
				rel="noreferrer"
				class="hide-tiny"
			>
				Sponsor
			</a>
			<Logos class="show-tiny" />
		</nav>
		<Logos class="hide-tiny" />
	</header>
	<main id="main">
		<h1>
			<span class="highlight">Houdini</span> or: How I Learned to Stop Worrying and Love
			<span class="graphql">GraphQL</span>
			<Emoji name="exploding-head" height={75} fallback="🤯" />
		</h1>
		<section class="hero">
			<div>
				<p class="hero-text">
					It’s here. A <em>fully-featured</em> GraphQL client that seamlessly integrates with the framework
					of your choice.
				</p>
				<p class="hero-subtext">
					Start with a schema. Write queries and let Houdini take care of the rest. Fully automatic
					and totally customizable. <b>Declarative</b>, <b>Composable</b>, <b>Typesafe</b>.
					First-class support for
					<a data-sveltekit-preload-data href="/api/fragments">Fragments</a>,
					<a data-sveltekit-preload-data href="/api/subscription">Subscriptions</a>,
					<a data-sveltekit-preload-data href="/guides/pagination">Pagination</a>,
					<a data-sveltekit-preload-data href="/api/mutation#lists">List Mutations</a>,
					<a data-sveltekit-preload-data href="/api/mutation#optimistic-responses"
						>Optimistic Responses</a
					>, and so much more. You didn’t know you needed this.
				</p>
				<div class="hero-dive-in">
					<p>Dive in:</p>
					<nav class="framework-links">
						<a data-sveltekit-preload-data href="/intro">
							<img src="/images/svelte.svg" width="20px" aria-hidden="true" />
							SvelteKit
						</a>
						<a data-sveltekit-preload-data href="#disabled" disabled>
							<img src="/images/react.svg" width="20px" aria-hidden="true" />
							Next
							<div class="coming-soon">Coming Soon</div>
						</a>
						<a data-sveltekit-preload-data href="#disabled" disabled>
							<img src="/images/vue.svg" width="20px" aria-hidden="true" />
							Nuxt
							<div class="coming-soon">Coming Soon</div>
						</a>
						<a data-sveltekit-preload-data href="#disabled" disabled>
							<img src="/images/solid.svg" width="20px" aria-hidden="true" />
							SolidStart
							<div class="coming-soon">Coming Soon</div>
						</a>
					</nav>
				</div>
			</div>
			<CodeSample class="splash-code-sample" />
		</section>
		<div class="logos-container">
			<h2>Used in Production By</h2>
			<div class="logos">
				<a href="https://www.se.com" target="_blank" rel="noreferrer">
					<img src="/images/users/schneider-electric.svg" height="60px" />
				</a>
				<a href="https://tryhussle.com/" target="_blank" rel="noreferrer">
					<img src="/images/users/hussle.svg" height="60px" />
				</a>
				<a href="https://punchup.com" target="_blank" rel="noreferrer">
					<img src="/images/users/punchup.png" height="60px" />
				</a>
				<a href="https://dynamicprocess.io/" target="_blank" rel="noreferrer">
					<img src="/images/users/dynamic-process.svg" height="60px" />
				</a>
			</div>
		</div>
		<div class="selling-points">
			<Block class="splash-block">
				<h2>GraphQL, simplified</h2>
				<p>
					GraphQL makes a lot of promises but the other clients expect you to go though a silly
					amount of ceremony to see the benefits. Houdini integrates tightly in your existing tool
					chain to remove as much of the complexity as possible without compromising on features.
				</p>
			</Block>
			<Block class="splash-block">
				<h2>Great for Simple Cases, Amazing for Complex Ones</h2>
				<p>
					Whether you are a seasoned GraphQL developer or just starting out on your journey, Houdini
					will feel like a superpower. It leverages battle-tested patterns like fragment composition
					and connection-based pagination to deliver a developer experience you might not have known
					was even possible.
				</p>
			</Block>
			<Block class="splash-block">
				<h2>100% Typesafe</h2>
				<p>
					Houdini generates types for every document in your application. If you are a TypeScript
					person, you won't have to juggle any generic parameters or mess with complicated paths. If
					you prefer JSDocs, eveything just works.
				</p>
			</Block>
			<Block class="splash-block">
				<h2>Declarative</h2>
				<p>
					Updates to your application cache are made with a set of declarative fragments that avoid
					the surgical logic necessary to keep your application up to date.
				</p>
			</Block>
		</div>
		<div class="cta-container">
			<a href="/intro">
				<button> Get Started </button>
			</a>
		</div>
	</main>
</article>

<style>
	:root {
		--scrollbar-slider: #101318;
		--scrollbar-track: #272e38;
	}

	/* variables are assigned on article to avoid conflict with other pages */
	article {
		/* Colors  */
		--background-color-1: #20283d;
		--background-color-2: rgba(20, 21, 25, 1);
		--highlight: #855aff;
		--graphql: #e10098;
		--dark-grey: #16171b;
		--grey: #393b43;
		--light-grey: #979aa6;
		--lightest-grey: #d2d9f5;

		/* Dimensions */
		--max-width: 1024px;
		--gutter: 60px;
	}

	:global(body) {
		background: #20283d;
	}

	:global(.splash-block) {
		padding: 40px;
		display: flex;
		flex-direction: column;
		gap: 34px;
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

	header,
	main {
		max-width: calc(var(--max-width) + var(--gutter));
		margin: 0 auto;
		width: 100%;
		font-family: 'Hind';
	}

	nav {
		display: flex;
		flex-direction: row;
	}

	header nav {
		gap: 48px;
	}

	header a,
	header a:visited {
		color: #979aa6;
		font-family: 'Hind';
		text-decoration: none;
	}

	header a:hover {
		color: white;
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

	article {
		padding: 48px var(--gutter);
		background: var(--background-color-1);
		background: linear-gradient(
			180deg,
			var(--background-color-1) 0%,
			var(--background-color-2) 900px
		);
		display: flex;
		flex-direction: column;
		gap: 100px;
		padding-bottom: 100px;
	}

	main {
		display: flex;
		flex-direction: column;
		gap: 128px;
	}
	h1 {
		font-size: 64px;
		font-family: 'Hind';
		font-weight: bolder;
		color: white;
		line-height: 1.2;
		text-align: center;
	}

	.highlight {
		color: var(--highlight);
	}

	.graphql {
		color: var(--graphql);
	}

	header,
	.logo {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
	}

	.logo {
		font-size: 22px;
		gap: 8px;
		font-family: 'Hind';
		font-weight: bolder;
		color: white;
	}

	.hero {
		display: flex;
		flex-direction: row;
		gap: 94px;
	}

	.hero > div {
		display: flex;
		flex-direction: column;
		width: 10px;
		justify-content: space-between;
	}

	.hero > *:first-child {
		flex-grow: 5;
		padding-bottom: 35px;
		width: 10px;
	}

	:global(.splash-code-sample) {
		flex-grow: 4;
		width: 10px;
	}

	.hero-text {
		font-size: 30px;
		color: white;
		font-family: 'Hind';
		font-weight: 100;
		line-height: 1.2;
	}

	.hero-subtext {
		color: #979aa6;
		font-size: 18px;
		line-height: 1.5;
		font-family: 'Hind';
		font-weight: 100;
	}

	.hero-subtext :is(a, a:visited) {
		color: #979aa6;
	}

	em {
		font-style: italic;
	}

	b {
		font-weight: 600;
	}

	.hero-dive-in {
		color: white;
		font-size: 18px;
	}

	.hero-dive-in {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.framework-links {
		display: flex;
		flex-direction: row;
		gap: 32px;
	}

	.framework-links a {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		padding: 10px 16px;
		border: 1px solid var(--grey);
		gap: 4px;
		font-size: 16px;
		border-radius: 8px;
		background: #131925;
		color: #a3accf;
		text-decoration: none;
		position: relative;
		overflow: hidden;
	}

	.coming-soon {
		width: 120%;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: absolute;
		transform: rotate(15deg) translateX(-50%) translateY(50%) translateY(10px);
		background: var(--grey);
		color: white;
		left: 50%;
		opacity: 0.8;
		font-size: 12px;
		display: none;
	}

	.framework-links a:visited {
		background: #131925;
		color: #a3accf;
		text-decoration: none;
		box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.15);
	}

	.framework-links a[disabled] {
		background: #262e3e;
		cursor: default;
		box-shadow: none;
		opacity: 0.2;
	}

	.selling-points {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 40px;
	}

	.selling-points h2 {
		font-size: 18px;
		font-weight: 500;
		color: var(--lightest-grey);
	}

	.selling-points p {
		color: var(--light-grey);
		line-height: 1.5;
	}

	.cta-container {
		display: flex;
		flex-direction: row;
		justify-content: center;
	}

	.cta-container button {
		font-size: 16px;
		padding: 20px 60px;
		border-radius: 5px;
		color: white;
		background: var(--highlight);
		font-weight: bold;
		border: none;
		cursor: pointer;
	}

	:global(.show-tiny) {
		display: none !important;
	}

	.logos {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: 64px;
	}

	.logos-container {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.logos-container h2 {
		color: var(--lightest-grey);
		align-self: center;
		font-size: 18px;
		margin-bottom: 40px;
	}

	@media (max-width: 1050px) {
		main {
			gap: 64px;
		}

		article {
			padding: 48px;
		}

		.hero {
			flex-direction: column;
		}

		.hero > *:first-child {
			padding: 50px;
			width: calc(100% - 100px);
			gap: 50px;
		}

		:global(.splash-code-sample) {
			width: 100%;
			padding-bottom: 50px;
		}

		.logos {
			display: grid;
			grid-template-columns: 1fr 1fr;
			padding-bottom: 50px;
		}

		.logos > * {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 100%;
		}
	}

	@media (max-width: 850px) {
		article {
			padding: 42px;
		}
		.selling-points {
			grid-template-columns: 1fr;
		}

		.logos {
			grid-template-columns: 1fr;
		}

		.hero {
			gap: 40px;
		}

		header nav {
			gap: 32px;
		}
	}

	@media (max-width: 777px) {
		article {
			padding: 36px;
		}
		.framework-links {
			display: grid;
			grid-template-columns: 1fr 1fr;
		}

		.framework-links a {
			width: calc(100% - 40px);
			padding: 10px 16px;
		}
	}

	@media (max-width: 700px) {
		article {
			padding: 24px;
		}
		.hide-thin {
			display: none;
		}
	}

	@media (max-width: 650px) {
		article {
			padding: 12px;
		}
		.hide-thinner {
			display: none;
		}
	}

	@media (max-width: 600px) {
		.hero > *:first-child {
			padding: 0px;
			width: 100%;
		}

		:global(.hide-tiny) {
			display: none !important;
		}

		:global(.show-tiny) {
			display: flex !important;
		}
	}
</style>
