<script lang="ts">
  import { CachePolicy } from '$houdini';
  import type { PageData } from '../../svelte5/simple/$houdini';

  const { data } = $props<{ data: PageData }>();
  const { Svelte5Simple } = $derived(data);
</script>

<p>{$Svelte5Simple.data?.usersConnection.edges.map(({ node }) => node?.name).join(', ')}</p>

<pre>{JSON.stringify($Svelte5Simple.pageInfo, null, 2)}</pre>

<button onclick={() => Svelte5Simple.loadNextPage()}>load more</button>
