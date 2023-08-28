<script lang="ts">
	import type { SponsorInfo } from '$houdini';
	import Link from '$lib/Link.svelte';
	import Sponsors from '$lib/Sponsors.svelte';
	import type { PageData } from './$houdini';

	export let data: PageData;

	$: ({ PageSponsors } = data);

	$: grouped =
		$PageSponsors.data?.sponsors.reduce((acc: Record<string, SponsorInfo[]>, sponsor) => {
			acc[sponsor.tiersTitle] = acc[sponsor.tiersTitle] || [];
			acc[sponsor.tiersTitle].push(sponsor);
			return acc;
		}, {}) ?? {};
</script>

<h2>Sponsors</h2>
<center>
	{#each Object.entries(grouped) as [key, sponsors]}
		<h3>{key}</h3>
		{#each sponsors as sponsor}
			<Sponsors {sponsor} />
		{/each}
	{/each}
</center>
