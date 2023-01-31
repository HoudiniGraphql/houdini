<script>
	import { page } from '$app/stores'

	export let title = 'Houdini'
	export let description = 'The disappearing GraphQL client for SvelteKit'
	export let url = 'https://houdinigraphql.com'

	// TODO JYC: do we want to keep the url in params? Or we could take $page.url.href?
	const getUrl = () => {
		return $page.url.href
	}

	const getImg = () => {
		const [part0, part1, part2] = $page.url.pathname.split('/')
		if (part1 && part2) {
			return `${$page.url.origin}/images/og/houdini-${part1}-${part2}.png`
		}
		return `${$page.url.origin}/images/og/houdini.png`
	}
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:url" content={getUrl()} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={getImg()} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={getImg()} />
</svelte:head>
