<script lang="ts">
  import { graphql, paginatedFragment } from '$houdini';

  $: queryResult = graphql(`
    query UserFragmentBackwardsCursorQuery @load {
      user(id: "1", snapshot: "pagination-fragment-backwards-cursor") {
        ...BackwardsCursorFragment
      }
    }
  `);

  $: fragmentResult = paginatedFragment(
    $queryResult.data?.user ?? null,
    graphql(`
      fragment BackwardsCursorFragment on User {
        friendsConnection(last: 2) @paginate {
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

<button id="previous" on:click={() => fragmentResult?.loadPreviousPage()}>previous</button>
