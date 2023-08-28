<script lang="ts">
	import type { SponsorInfo } from '$houdini';
	import type { PageData } from './$houdini';
	import Sponsors from './Sponsors.svelte';

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
	{#if $PageSponsors.fetching}
		Loading...
	{:else if $PageSponsors.errors}
		{#each $PageSponsors.errors as error}
			{error.message}
		{/each}
	{:else}
		{#each Object.entries(grouped) as [key, sponsors], i}
			{@const size = 0.8 + (Object.entries(grouped).length - i) / 5}
			<h3 style="font-size: {size}rem;">{key}</h3>
			<div class="list">
				{#each sponsors as sponsor}
					<Sponsors {sponsor} {size} />
				{/each}
			</div>
		{/each}
	{/if}
</center>

<style>
	.list {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-evenly;
		gap: 1rem;
		margin-bottom: 3rem;
	}
</style>
