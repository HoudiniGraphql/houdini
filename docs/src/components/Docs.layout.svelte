<script context="module">
	import Header1 from './Header1.svelte'
	import Header2 from './Header2.svelte'
	import Header3 from './Header3.svelte'
	import Code from './Code.svelte'
	export { Header1 as h1, Header2 as h2, Header3 as h3, Code as code }
</script>

<script>
	export let title
	export let description
</script>

<svelte:head>
	<meta name="description" content={description} />
	<meta property="og:description" content={description} />
	<meta property="og:title" content={title} />
	<title>{title}</title>
</svelte:head>

<main>
	<article>
		<slot />
	</article>
</main>

<style global>
	article {
		padding-top: 2rem;
		padding-bottom: 2rem;
	}

	article a {
		color: var(--color2);
		text-decoration: none;
	}

	a:hover {
		text-decoration: underline;
	}

	p {
		margin-bottom: 1rem;
	}

	article li::marker {
		color: rgba(0, 0, 0, 0.2);
	}

	article li::before {
		content: '';
		padding-inline: 0.25rem;
	}

	article ul {
		margin-left: 1.5rem;
		margin-bottom: 1rem;
	}

	pre {
		border-radius: 0.25rem;
	}
</style>
