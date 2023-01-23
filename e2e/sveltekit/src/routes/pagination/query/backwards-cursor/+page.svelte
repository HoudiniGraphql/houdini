<script lang="ts">
  import { CachePolicy, graphql } from '$houdini';

  const result = graphql(`
    query BackwardsCursorPaginationQuery @load {
      usersConnection(last: 2, snapshot: "pagination-query-backwards-cursor") @paginate {
        edges {
          node {
            name
          }
        }
      }
    }
  `);
</script>

<div id="result">
  {$result.data?.usersConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($result.pageInfo)}
</div>

<button id="previous" on:click={() => result.loadPreviousPage()}>previous</button>

<button id="refetch" on:click={() => result.fetch({ policy: CachePolicy.NetworkOnly })}
  >refetch</button
>
