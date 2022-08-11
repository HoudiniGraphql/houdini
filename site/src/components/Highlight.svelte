<script>
	import Prism from 'prismjs'
	import 'prism-svelte'

	export let language = 'svelte'
	export let code
</script>

<pre class="code showcase-example" {...$$props}>
{@html Prism.highlight(code, Prism.languages[language])}
</pre>
