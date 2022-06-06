<script context="module" lang="ts">
  export function ForwardCursorPaginationQueryVariables() {
    return {
      first: 2 // default value!
    };
  }
</script>

<script lang="ts">
  import { graphql, paginatedQuery, type ForwardCursorPaginationQuery } from '$houdini';

  const { data, loadNextPage, refetch, pageInfo } =
    paginatedQuery<ForwardCursorPaginationQuery>(graphql`
      query ForwardCursorPaginationQuery($first: Int!) {
        usersConnection(first: $first, snapshot: "pagination-query-forwards-cursor") @paginate {
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
<div>
  {JSON.stringify($data)}
</div>

<button id="next" on:click={() => loadNextPage()}>next</button>

<button id="refetch" on:click={() => refetch()}>refetch</button>
