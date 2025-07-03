<script lang="ts">
  import { graphql, CachePolicy } from '$houdini';
  import type { PageData } from './$houdini';
  export let data: PageData;

  $: ({ OffsetVariablePaginationQuery: result } = data)
</script>

<div id="result">
  {$result.data?.usersList.map((user) => user?.name).join(', ')}
</div>

<button id="next" on:click={() => result.loadNextPage()}>next</button>

<button id="refetch" on:click={() => result.fetch({ policy: CachePolicy.NetworkOnly })}
  >refetch</button
>
