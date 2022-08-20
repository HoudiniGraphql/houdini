<script lang="ts">
  import {
    paginatedFragment,
    graphql,
    query,
    type BackwardsCursorFragment,
    type UserFragmentBackwardsCursorQuery
  } from '$houdini';

  const queryResult = query<UserFragmentBackwardsCursorQuery>(graphql`
    query UserFragmentBackwardsCursorQuery {
      user(id: "1", snapshot: "pagination-fragment-backwards-cursor") {
        ...BackwardsCursorFragment
      }
    }
  `);

  const fragmentResult = paginatedFragment<BackwardsCursorFragment>(
    $queryResult.data?.user ?? null,
    graphql`
      fragment BackwardsCursorFragment on User {
        friendsConnection(last: 2) @paginate {
          edges {
            node {
              name
            }
          }
        }
      }
    `
  );
</script>

<div id="result">
  {$fragmentResult?.data.friendsConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($fragmentResult.pageInfo)}
</div>

<button id="previous" on:click={() => loadPreviousPage()}>previous</button>
