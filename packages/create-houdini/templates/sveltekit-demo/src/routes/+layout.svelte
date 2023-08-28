<script lang="ts">
	import type { PageData } from './$houdini';

	export let data: PageData;

	$: ({ Layout } = data);
</script>

<svelte:head>
	<title>Houdini • demo • SvelteKit</title>
	<link rel="icon" type="image/png" href="https://houdinigraphql.com/images/logo.png" />
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/dark.css" />
</svelte:head>

<h1>{$Layout.data?.welcome}</h1>

<a href="/">Home</a> |
<a href="/sponsors">Sponsors</a>

<hr />

<slot />
