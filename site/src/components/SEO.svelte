<script>
	export let title = 'Houdini'
	export let description = 'The disappearing GraphQL client for SvelteKit'
	export let url = 'https://houdinigraphql.com'
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={url} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content="https://www.houdinigraphql.com/images/og-image.png" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content="https://www.houdinigraphql.com/images/og-image.png" />
</svelte:head>
