<svelte:head>
	<link rel="icon" type="image/png" href="https://houdinigraphql.com/images/logo.png" />
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/dark.css" />
	<title>Houdini & SvelteKit</title>
</svelte:head>

<h1>Welcome to Houdini & SvelteKit</h1>

<hr />
<a href="/">Home</a> |
<a href="/page-1">Page 1</a> |
<a href="/page-2">Page 2</a>
<hr />

<slot />

<footer>
	<i
		>//Made with 🧡 - Join us on&nbsp;<a href="https://github.com/HoudiniGraphql/houdini">GitHub</a>
		⭐</i
	>
</footer>

<style>
	footer {
		text-align: center;
		margin-top: 2rem;
	}
</style>
