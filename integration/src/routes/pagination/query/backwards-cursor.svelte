<script lang="ts">
  import { paginatedQuery, graphql, type BackwardsCursorPaginationQuery } from '$houdini';

  const { data, loadPreviousPage, refetch, pageInfo } =
    paginatedQuery<BackwardsCursorPaginationQuery>(graphql`
      query BackwardsCursorPaginationQuery {
        usersConnection(last: 2) @paginate {
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
  {$data?.usersConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($pageInfo)}
</div>

<button id="previous" on:click={() => loadPreviousPage()}>next</button>

<button id="refetch" on:click={() => refetch()}>refetch</button>
