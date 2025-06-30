<script lang="ts">
  import { CachePolicy, graphql } from '$houdini';
  import type { PageData } from './$houdini'

  export let data: PageData

  $: ({ BidirectionalCursorSinglePagePaginationQuery: result } = data);
</script>

<div id="result">
  {$result.data?.usersConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($result.data?.usersConnection.pageInfo)}
</div>

<button
  id="previous"
  on:click={() => result.loadPreviousPage({ last: 2 })}
  disabled={!$result.data?.usersConnection.pageInfo.hasPreviousPage}
>
  previous
</button>
<button
  id="next"
  on:click={() => result.loadNextPage({ first: 2 })}
  disabled={!$result.data?.usersConnection.pageInfo.hasNextPage}
>
  next
</button>

<button id="refetch" on:click={() => result.fetch({ policy: CachePolicy.NetworkOnly })}>
  refetch
</button>
