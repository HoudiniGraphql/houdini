<script lang="ts">
	import { PendingValue, fragment, graphql } from '$houdini';
	import type { LinkInfo } from '$houdini';

	export let link: LinkInfo;
	$: data = fragment(
		link,
		graphql(`
			fragment LinkInfo on Link {
				name @loading
				url
			}
		`)
	);
</script>

{#if $data.name === PendingValue}
	<div class="skeleton" />
{:else}
	<a href={$data.url} target="_blank">{$data.name}</a>
{/if}

<style>
	.skeleton {
		animation: skeleton-loading 0.5s linear infinite alternate;
		width: 10rem;
		height: 1rem;
		border-radius: 0.25rem;
	}

	@keyframes skeleton-loading {
		0% {
			background-color: hsl(200, 20%, 80%);
		}
		100% {
			background-color: hsl(200, 20%, 95%);
		}
	}
</style>
