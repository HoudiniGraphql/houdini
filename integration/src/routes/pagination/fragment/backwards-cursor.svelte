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
      user(id: "1") {
        ...BackwardsCursorFragment
      }
    }
  `);

  const {
    data: userData,
    pageInfo,
    loadPreviousPage,
    refetch
  } = paginatedFragment<BackwardsCursorFragment>(
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
    `,
    $data!.user
  );
</script>

<div id="result">
  {$userData?.friendsConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($pageInfo)}
</div>

<button id="next" on:click={() => loadPreviousPage()}>next</button>

<button id="refetch" on:click={() => refetch()}>refetch</button>
