<script lang="ts">
  import { paginatedQuery, graphql, type BackwardsCursorPaginationQuery, MyEnum } from '$houdini';

  const { data, loadPreviousPage, refetch, pageInfo } =
    paginatedQuery<BackwardsCursorPaginationQuery>(graphql`
      query BackwardsCursorPaginationQuery {
        usersConnection(last: 2, snapshot: "pagination-query-backwards-cursor") @paginate {
          edges {
            node {
              name
            }
          }
        }
      }
    `);

  console.log(MyEnum.Value1);
</script>

<div id="result">
  {$data?.usersConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($pageInfo)}
</div>

<button id="previous" on:click={() => loadPreviousPage()}>previous</button>

<button id="refetch" on:click={() => refetch()}>refetch</button>
