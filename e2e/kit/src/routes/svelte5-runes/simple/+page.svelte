<script lang="ts">
  import type { PageData } from './$houdini';

  const { data }: { data: PageData } = $props();
  const { Svelte5Simple } = $derived(data);
</script>

<p>{$Svelte5Simple.data?.usersConnection.edges.map(({ node }) => node?.name).join(', ')}</p>

<pre>{JSON.stringify($Svelte5Simple.pageInfo, null, 2)}</pre>

<button onclick={() => Svelte5Simple.loadNextPage()}>load more</button>
