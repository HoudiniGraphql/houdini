<script lang="ts">
  import {
    paginatedFragment,
    graphql,
    query,
    type UserFragmentForwardsCursorQuery,
    type ForwardsCursorFragment
  } from '$houdini';

  const { data } = query<UserFragmentForwardsCursorQuery>(graphql`
    query UserFragmentForwardsCursorQuery {
      user(id: "1", snapshot: "pagination-fragment-forwards-cursor") {
        ...ForwardsCursorFragment
      }
    }
  `);

  const {
    data: userData,
    pageInfo,
    loadNextPage,
    refetch
  } = paginatedFragment<ForwardsCursorFragment>(
    graphql`
      fragment ForwardsCursorFragment on User {
        friendsConnection(first: 2) @paginate {
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

  $: console.log($userData);
</script>

<div id="result">
  {$userData?.friendsConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($pageInfo)}
</div>

<button id="next" on:click={() => loadNextPage()}>next</button>

<button id="refetch" on:click={() => refetch()}>refetch</button>
