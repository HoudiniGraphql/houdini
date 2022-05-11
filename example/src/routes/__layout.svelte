<script context="module">
	import env from '../environment'
	import { setEnvironment } from '$houdini'
	import cache from '$houdini/runtime/cache'
	import { browser } from '$app/env'

	if (browser) {
		// @ts-ignore
		window.cache = cache
	}

	setEnvironment(env)
</script>

<svelte:head>
	<title>Houdini • TodoMVC</title>
	<link rel="stylesheet" href="//unpkg.com/todomvc-common/base.css" />
	<link rel="stylesheet" href="//unpkg.com/todomvc-app-css/index.css" />
</svelte:head>

<section class="todoapp">
	<a href="/all">Original</a>
	<a href="/kql">Store</a>
	<a href="/nothing">Nothing</a>
	<hr />
	<slot />
</section>

<footer class="info">
	<p>Double-click to edit a todo</p>
	<p>Created by <a href="http://todomvc.com">Alec Aivazis</a></p>
	<p>Part of <a href="http://todomvc.com">TodoMVC</a></p>
</footer>
