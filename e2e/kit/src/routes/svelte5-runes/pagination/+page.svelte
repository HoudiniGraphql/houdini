<script lang="ts">
  import type { PageData } from './$houdini';

  interface Props {
    data: PageData;
  }
  const { data }: Props = $props();
  const { Svelte5Pagination } = $derived(data);
</script>

<div id="result">
  {$Svelte5Pagination.data?.usersConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">{JSON.stringify($Svelte5Pagination.pageInfo)}</div>

<button id="next" onclick={() => Svelte5Pagination.loadNextPage()}>load more</button>
