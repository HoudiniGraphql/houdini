<script lang="ts">
import { graphql, isPending, paginatedFragment, type PaginatedFragmentAtLoading_Friends } from '$houdini'

export let user: PaginatedFragmentAtLoading_Friends

$: store = paginatedFragment(
	user,
	graphql(`
		fragment PaginatedFragmentAtLoading_Friends on User @loading {
			friendsConnection(first: 2) @paginate {
				edges {
					node {
						name
					}
				}
			}
		}
	`)
)
</script>

<!-- isPending guards the resolved-only render: during the parent's @loading frame the data
     is pending, so we skip stringifying it (joining PendingValue names would throw) -->
{#if $store.data && !isPending($store.data)}
	<div id="result">
		{$store.data.friendsConnection.edges.map(({ node }) => node?.name).join(', ')}
	</div>
{/if}

<!-- rendered unconditionally so it can be clicked during the parent's @loading frame: the
     handler must no-op then rather than fire node(id: PendingValue) (issue #1408) -->
<button id="next" on:click={() => store.loadNextPage()}>next</button>
