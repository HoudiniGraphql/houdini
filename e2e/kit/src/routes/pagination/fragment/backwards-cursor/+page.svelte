<script lang="ts">
  import { graphql, paginatedFragment } from '$houdini';
  import type { PageData } from './$houdini'

  export let data: PageData;

  $:({ UserFragmentBackwardsCursorQuery: queryResult } = data);

  $: fragmentResult = paginatedFragment(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    $queryResult.data?.user,
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
