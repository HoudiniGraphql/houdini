<script>
	import Prism from 'prismjs'
	import 'prism-svelte'

	export let language = 'svelte'
	export let code
</script>

<pre {...$$props} class={`code ${$$props.class ?? ''}`}>
{@html Prism.highlight(code, Prism.languages[language] || Prism.languages['javascript'])}
</pre>
