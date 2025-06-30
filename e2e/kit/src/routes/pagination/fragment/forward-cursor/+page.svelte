<script lang="ts">
  import { paginatedFragment, graphql } from '$houdini';
  import type { PageData } from './$houdini';

  export let data: PageData

  $: ({ UserFragmentForwardsCursorQuery: queryResult } = data);

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
