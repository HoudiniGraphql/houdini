<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;
  $: ({ DedupePaginationFetch } = data);
</script>

<div id="result">
  {$DedupePaginationFetch.data?.usersConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($DedupePaginationFetch.pageInfo)}
</div>

<button id="next" on:click={() => DedupePaginationFetch.loadNextPage()}>next</button>
