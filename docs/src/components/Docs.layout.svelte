<script context="module">
	import Code from './Code.svelte'
	export { Code as code }
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
		padding-top: 4.5rem;
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

	h2,
	h3,
	h4,
	h5,
	h6 {
		font-weight: 700;
		margin-bottom: 1rem;
		margin-top: 1rem;
	}

	h1 {
		font-weight: 700;
		margin-bottom: 1rem;
		font-size: 1.5rem;
		line-height: 2rem;
	}

	h1:not(:first-of-type) {
		border-top: 1px solid rgb(216, 210, 210);
		padding-top: 1.5rem;
		margin-top: 2rem;
	}

	h2 {
		font-size: 1.25rem;
		line-height: 1.75rem;
	}

	h3 {
		font-size: 1.125rem;
		line-height: 1.75rem;
	}

	h4 {
		font-size: 1rem;
		line-height: 1.5rem;
	}

	h5 {
		font-size: 0.875rem;
		line-height: 1.25rem;
	}

	h6 {
		font-size: 0.75rem;
		line-height: 1rem;
	}

	.hash-link {
		opacity: 0;
		transition: opacity 200ms;
		font-size: inherit;
	}

	h1 a,
	h2 a,
	h3 a,
	h4 a,
	h5 a,
	h6 a {
		font-size: inherit;
		font-weight: inherit;
	}

	h1:hover .hash-link,
	h2:hover .hash-link,
	h3:hover .hash-link,
	h4:hover .hash-link,
	h5:hover .hash-link,
	h6:hover .hash-link {
		opacity: 1;
	}

	.hash-link::before {
		content: '#';

		margin-left: 0.5rem;
	}
</style>
