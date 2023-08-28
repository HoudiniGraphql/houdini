<script lang="ts">
	import type { PageData } from './$houdini';
	import Link from './Link.svelte';

	export let data: PageData;

	$: ({ PageHome } = data);
</script>

<h2>Links</h2>
<ul>
	{#each $PageHome.data?.links ?? [] as link}
		<li>
			<Link {link} />
		</li>
	{/each}
</ul>
