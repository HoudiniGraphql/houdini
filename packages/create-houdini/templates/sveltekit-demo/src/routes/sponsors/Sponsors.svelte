<script lang="ts">
	import { fragment, graphql } from '$houdini';
	import type { SponsorInfo } from '$houdini';

	export let sponsor: SponsorInfo;
	export let size: number = 1;
	$: data = fragment(
		sponsor,
		graphql(`
			fragment SponsorInfo on Sponsor {
				login
				name
				avatarUrl
			}
		`)
	);
</script>

<a href="https://github.com/{$data.login}" target="_blank" style="font-size: {size}rem;">
	<img src={$data.avatarUrl} alt={$data.name} width={size * 50} />
	<span>{$data.name}</span>
</a>

<style>
	img {
		border-radius: 30%;
	}

	a {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
</style>
