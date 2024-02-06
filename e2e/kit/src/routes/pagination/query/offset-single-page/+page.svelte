<script lang="ts">
  import { graphql, CachePolicy } from '$houdini';

  $: result = graphql(`
    query OffsetPaginationSinglePageQuery @load {
      usersList(limit: 2, snapshot: "pagination-query-offset-single-page")
        @paginate(mode: SinglePage) {
        name
      }
    }
  `);
</script>

<div id="result">
  {$result.data?.usersList.map((user) => user?.name).join(', ')}
</div>

<button id="next" on:click={() => result.loadNextPage()}>next</button>

<button id="refetch" on:click={() => result.fetch({ policy: CachePolicy.NetworkOnly })}
  >refetch</button
>
