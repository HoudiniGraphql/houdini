<script>
	import { SEO, Highlight } from '~/components'

	const codeExample = `<script lang=”ts”>
  import { graphql } from '$houdini'

  const allItems = graphql(\`
    query AllTodoItems {
      items {
        text
      }
    }
  \`)
\<\/script>

{#each $allItems.data.items as item}
  <div>{item.text}</div>
{/each}`
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
			<a data-sveltekit-preload-data href="/intro/welcome">Getting Started</a>
			<a data-sveltekit-preload-data href="/api/welcome">API Docs</a>
			<a data-sveltekit-preload-data href="/guides/faq">Guides</a>
			<a
				data-sveltekit-preload-data
				href="https://github.com/sponsors/HoudiniGraphql"
				target="_blank"
				rel="noreferrer"
			>
				Sponsor
			</a>
		</nav>

		<a
			href="https://www.github.com/HoudiniGraphQL/houdini"
			class="tiny-hidden"
			target="_blank"
			rel="noreferrer"
		>
			<svg
				height="20px"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 32.58 31.77"
				class="gh-link"
				><defs><style></style></defs><g id="Layer_2" data-name="Layer 2"
					><g id="Layer_1-2" data-name="Layer 1"
						><path
							fill="currentcolor"
							class="cls-1"
							d="M16.29,0a16.29,16.29,0,0,0-5.15,31.75c.82.15,1.11-.36,1.11-.79s0-1.41,0-2.77C7.7,29.18,6.74,26,6.74,26a4.36,4.36,0,0,0-1.81-2.39c-1.47-1,.12-1,.12-1a3.43,3.43,0,0,1,2.49,1.68,3.48,3.48,0,0,0,4.74,1.36,3.46,3.46,0,0,1,1-2.18c-3.62-.41-7.42-1.81-7.42-8a6.3,6.3,0,0,1,1.67-4.37,5.94,5.94,0,0,1,.16-4.31s1.37-.44,4.48,1.67a15.41,15.41,0,0,1,8.16,0c3.11-2.11,4.47-1.67,4.47-1.67A5.91,5.91,0,0,1,25,11.07a6.3,6.3,0,0,1,1.67,4.37c0,6.26-3.81,7.63-7.44,8a3.85,3.85,0,0,1,1.11,3c0,2.18,0,3.94,0,4.47s.29.94,1.12.78A16.29,16.29,0,0,0,16.29,0Z"
						/></g
					></g
				></svg
			>
		</a>
	</header>
	<main id="main">
		<h1>
			<span class="highlight">Houdini</span> or: How I Learned to Stop Worrying and Love
			<span class="graphql">GraphQL</span> 🤯
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
					First-class support for Subscriptions, Pagination, List Mutations, Optimistic Responses,
					and so much more. You didn’t know you needed this.
				</p>
				<div class="hero-dive-in">
					<p>Dive in:</p>
					<nav class="framework-links">
						<a data-sveltekit-preload-data href="/intro/welcome">
							<img src="/images/svelte.svg" width="20px" />
							SvelteKit
						</a>
						<a data-sveltekit-preload-data href="javascript:void(0)" disabled>
							<img src="/images/react.svg" width="20px" />
							Next
						</a>
						<a data-sveltekit-preload-data href="javascript:void(0)" disabled>
							<img src="/images/vue.svg" width="20px" />
							Nuxt
						</a>
						<a data-sveltekit-preload-data href="javascript:void(0)" disabled>
							<img src="/images/solid.svg" width="20px" />
							SolidStart
						</a>
					</nav>
				</div>
			</div>
			<div>
				<div class="code-example-container">
					<div class="code-example block">
						<div class="code-example-header">
							<div class="code-example-filename">+page.svelte</div>
							<div class="code-example-location">
								src
								<span class="code-example-location-chevron">></span>
								routes
								<span class="code-example-location-chevron">></span>
								items
								<span class="code-example-location-chevron">></span>
								+page.svelte
							</div>
						</div>
						<div class="code-example-body">
							<div class="code-example-numbers">
								<div>1</div>
								<div>2</div>
								<div>3</div>
								<div>4</div>
								<div>5</div>
								<div>6</div>
								<div>7</div>
								<div>8</div>
								<div>9</div>
								<div>10</div>
								<div>11</div>
								<div>12</div>
								<div>13</div>
								<div>14</div>
								<div>15</div>
							</div>
							<code>
								<Highlight code={codeExample} class="code" />
							</code>
						</div>
					</div>
					<p class="code-example-subtext">
						This is all you need to get going with SSR.&nbsp;&nbsp;&nbsp;🚀
					</p>
				</div>
			</div>
		</section>
	</main>
</article>

<style>
	:root {
		--scrollbar-slider: #101318;
		--scrollbar-track: #272e38;
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
		max-width: 1024px;
		margin: 0 auto;
		width: 100%;
		font-family: 'Hind';
	}

	nav {
		display: flex;
		flex-direction: row;
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
		padding: 48px 0;
		background: #20283d;
		background: linear-gradient(180deg, #20283d 0%, rgba(20, 21, 25, 1) 900px);
		display: flex;
		flex-direction: column;
		gap: 100px;
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
		color: #855aff;
	}

	.graphql {
		color: #e10098;
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

	.hero > div:first-child {
		flex-grow: 5;
		padding-bottom: 35px;
	}
	.hero > div:nth-child(2) {
		flex-grow: 4;
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

	em {
		font-style: italic;
	}

	b {
		font-weight: 600;
	}

	.block {
		background: #16171b;
		border: 1px solid #393b43;
		border-radius: 16px;
		box-shadow: 0 16px 50px 0 rgba(0, 0, 0, 0.35);
	}

	:global(.code),
	.code-example-body {
		font-size: 14px !important;
		font-family: 'Fira Mono';
	}

	.code-example-numbers {
		padding: 4px;
		line-height: 1.5rem;
		width: 28px;
		flex-grow: 0;
		border-right: 1px solid #393b43;
		color: #393b43;
		margin-right: 8px;
		text-align: center;
		padding-top: 16px;
		padding-bottom: 16px;
	}

	.code-example-header {
		background: #393b43;
		border-top-left-radius: 16px;
		width: 280px;
		padding: 8px 16px;
	}

	.code-example {
		width: 555px;
		padding: 0px;
	}
	.code-example-container {
		display: flex;
		flex-direction: column;
		gap: 20px;
		align-items: center;
	}

	.code-example-container,
	.code-example {
		width: 100% !important;
	}

	.code-example-text {
		font-size: 16px;
		color: #9194a4;
	}
	.code-example-subtext {
		font-size: 14px;
		color: #9194a4;
	}
	.code-example-body {
		display: flex;
		flex-direction: row;
	}

	.code-example-body code {
		padding: 12px 0 16px 0;
	}

	.code-example-filename {
		color: white;
		font-family: 'Fira Sans';
		font-size: 16px;
		margin-bottom: 6px;
	}

	.code-example-location {
		color: #838797;
		font-family: 'Fira Mono';
		font-size: 12px;
	}

	.code-example-location-chevron {
		color: #91a2e5;
		font-size: 10px;
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
		gap: 24px;
	}

	.framework-links a {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: flex-start;
		padding: 10px 16px;
		border: 1px solid #393b43;
		gap: 8px;
		font-size: 16px;
		border-radius: 8px;
		background: #131925;
		color: #a3accf;
		text-decoration: none;
		width: 180px;
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
	}
</style>
