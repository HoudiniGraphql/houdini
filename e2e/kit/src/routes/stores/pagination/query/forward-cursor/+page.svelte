<script lang="ts">
  import { CachePolicy, StoreForwardCursorPaginationQueryStore } from '$houdini';
  import { onMount } from 'svelte';

  const storeForwardCursorPaginationQuery = new StoreForwardCursorPaginationQueryStore();

  onMount(() => {
    storeForwardCursorPaginationQuery.fetch();
  });

  function loadNextPage() {
    storeForwardCursorPaginationQuery.loadNextPage();
  }

  function refetch() {
    storeForwardCursorPaginationQuery.fetch({ policy: CachePolicy.NetworkOnly });
  }
</script>

<div id="result">
  {$storeForwardCursorPaginationQuery?.data?.usersConnection.edges
    .map(({ node }) => node?.name)
    .join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($storeForwardCursorPaginationQuery?.pageInfo)}
</div>

<button id="next" on:click={() => loadNextPage()}>next</button>

<button id="refetch" on:click={() => refetch()}>refetch</button>
