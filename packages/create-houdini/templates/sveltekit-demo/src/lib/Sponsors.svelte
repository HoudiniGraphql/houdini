<script lang="ts">
	import { fragment, graphql } from '$houdini';
	import type { SponsorInfo } from '$houdini';

	export let sponsor: SponsorInfo;
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

<a href="https://github.com/{$data.login}" target="_blank">
	<img src={$data.avatarUrl} alt={$data.name} width="50" />
	{$data.name}
</a>
