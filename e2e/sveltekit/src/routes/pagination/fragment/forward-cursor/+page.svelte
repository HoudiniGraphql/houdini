<script lang="ts">
  import { paginatedFragment, graphql } from '$houdini';

  $: queryResult = graphql(`
    query UserFragmentForwardsCursorQuery @load {
      user(id: "1", snapshot: "pagination-fragment-forwards-cursor") {
        ...ForwardsCursorFragment
      }
    }
  `);

  $: fragmentResult = paginatedFragment(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    $queryResult.data?.user ?? null,
    graphql(`
      fragment ForwardsCursorFragment on User {
        friendsConnection(first: 2) @paginate {
          edges {
            node {
              name
            }
          }
        }
      }
    `)
  );
</script>

<div id="result">
  {$fragmentResult.data?.friendsConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($fragmentResult.pageInfo)}
</div>

<button id="next" on:click={() => fragmentResult?.loadNextPage()}>next</button>
