<script lang="ts">
	import Link from '$lib/Link.svelte';
	import type { PageData } from './$houdini';

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
