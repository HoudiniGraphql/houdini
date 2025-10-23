<script lang="ts">
  import { CachePolicy, graphql } from '$houdini';
  import type { PageData } from './$types'
  import { stringify } from '$lib/utils/stringify';

  export let data: PageData;

  $: ({ BidirectionalCursorPaginationQuery: result } = data);
</script>

<div id="result">
  {$result.data?.usersConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {stringify($result.pageInfo)}
</div>

<button id="previous" on:click={() => result.loadPreviousPage()}>previous</button>
<button id="next" on:click={() => result.loadNextPage()}>next</button>

<button id="refetch" on:click={() => result.fetch({ policy: CachePolicy.NetworkOnly })}
  >refetch</button
>
