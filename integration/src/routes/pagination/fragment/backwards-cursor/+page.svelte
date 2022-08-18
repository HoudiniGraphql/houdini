<script lang="ts">
  import {
    paginatedFragment,
    graphql,
    query,
    type BackwardsCursorFragment,
    type UserFragmentBackwardsCursorQuery
  } from '$houdini';

  const { data } = query<UserFragmentBackwardsCursorQuery>(graphql`
    query UserFragmentBackwardsCursorQuery {
      user(id: "1", snapshot: "pagination-fragment-backwards-cursor") {
        ...BackwardsCursorFragment
      }
    }
  `);

  const {
    data: userData,
    pageInfo,
    loadPreviousPage
  } = paginatedFragment<BackwardsCursorFragment>(
    $data ? $data.user : null,
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
  {$userData?.friendsConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($pageInfo)}
</div>

<button id="previous" on:click={() => loadPreviousPage()}>previous</button>
