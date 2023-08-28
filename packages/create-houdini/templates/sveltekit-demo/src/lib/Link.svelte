<script lang="ts">
	import { fragment, graphql } from '$houdini';
	import type { LinkInfo } from '$houdini';

	export let link: LinkInfo;
	$: data = fragment(
		link,
		graphql(`
			fragment LinkInfo on Link {
				name
				url
			}
		`)
	);
</script>

<a href={$data.url} target="_blank">{$data.name}</a>
