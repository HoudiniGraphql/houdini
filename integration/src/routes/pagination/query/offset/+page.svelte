<script lang="ts">
  import { paginatedQuery, graphql, type OffsetPaginationQuery } from '$houdini';

  const { data, loadNextPage, refetch } = paginatedQuery<OffsetPaginationQuery>(graphql`
    query OffsetPaginationQuery {
      usersList(limit: 2, snapshot: "pagination-query-offset") @paginate {
        name
      }
    }
  `);
</script>

<div id="result">
  {$data?.usersList.map((user) => user?.name).join(', ')}
</div>

<button id="next" on:click={() => loadNextPage()}>next</button>

<button id="refetch" on:click={() => refetch()}>refetch</button>
