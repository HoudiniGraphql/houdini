<script lang="ts">
  import {
    paginatedQuery,
    graphql,
    type ForwardCursorPaginationQuery,
    GQL_ForwardCursorPaginationQuery,
    CachePolicy,
    getHoudiniContext
  } from '$houdini';

  const { data, loadNextPage, refetch, pageInfo } =
    paginatedQuery<ForwardCursorPaginationQuery>(graphql`
      query ForwardCursorPaginationQuery {
        usersConnection(first: 2) @paginate {
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

<button id="next" on:click={() => loadNextPage()}>next</button>

<button id="refetch" on:click={() => refetch()}>refetch</button>
