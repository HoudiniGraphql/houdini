<script lang="ts">
import { PendingValue } from '$houdini'
import type { PageData } from './$types'
import Friends from './Friends.svelte'

export let data: PageData

$: ({ PaginatedFragmentAtLoading: store } = data)
</script>

{#if $store.data}
	<div id="name">
		{#if $store.data.user.name === PendingValue}
			loading...
		{:else}
			{$store.data.user.name}
		{/if}
	</div>

	<!-- rendered unguarded: the child spreads a @paginate fragment and must survive the
	     parent's @loading frame (issue #1408, where the if (!loading) guard was required) -->
	<Friends user={$store.data.user} />
{/if}
