<script>
	import { SEO, Emoji } from '~/components'
	import CodeSample from './CodeSample.svelte'
	import Block from './Block.svelte'
	import Logos from './Logos.svelte'
</script>

<SEO />

<a id="skip-nav" href="#main"> Skip to Content </a>

<article>
	<header>
		<div class="logo">
			<img src="/images/logo.svg" style="margin-top: -4px" />
			Houdini
		</div>
		<nav>
			<a data-sveltekit-preload-data href="/intro/welcome">Get Started</a>
			<a data-sveltekit-preload-data href="/guides/faq" class="hide-thin">Guides</a>
			<a data-sveltekit-preload-data href="/api/welcome" class="hide-thinner">API Docs</a>
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
			<img
				height="75px"
				src="data:image/png;base64,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"
			/>
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
						<a data-sveltekit-preload-data href="/intro/welcome">
							<img src="/images/svelte.svg" width="20px" />
							SvelteKit
						</a>
						<a data-sveltekit-preload-data href="#disabled" disabled>
							<img src="/images/react.svg" width="20px" />
							Next
							<div class="coming-soon">Coming Soon</div>
						</a>
						<a data-sveltekit-preload-data href="#disabled" disabled>
							<img src="/images/vue.svg" width="20px" />
							Nuxt
							<div class="coming-soon">Coming Soon</div>
						</a>
						<a data-sveltekit-preload-data href="#disabled" disabled>
							<img src="/images/solid.svg" width="20px" />
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
			<a href="/intro/welcome">
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
		.hide-thin {
			display: none;
		}
	}

	@media (max-width: 650px) {
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
