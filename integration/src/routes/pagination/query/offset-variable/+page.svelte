<script lang="ts">
  import { graphql, type OffsetVariablePaginationQueryStore, CachePolicy } from '$houdini';

  const result: OffsetVariablePaginationQueryStore = graphql`
    query OffsetVariablePaginationQuery($limit: Int!) {
      usersList(limit: $limit, snapshot: "pagination-query-offset-variable") @paginate {
        name
      }
    }
  `;
</script>

<div id="result">
  {$result.data?.usersList.map((user) => user?.name).join(', ')}
</div>

<button id="next" on:click={() => result.loadNextPage()}>next</button>

<button id="refetch" on:click={() => result.fetch({ policy: CachePolicy.NetworkOnly })}
  >refetch</button
>
