<script lang="ts">
  import { graphql, paginatedFragment } from '$houdini';
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ UserFragmentRequiredArgsQuery: queryResult } = data);

  $: fragmentResult = paginatedFragment(
    $queryResult.data?.user ?? null,
    graphql(`
      fragment TestFragment on User @arguments(snapshot: { type: "String!" }) {
        usersConnectionSnapshot(first: 2, snapshot: $snapshot) @paginate {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `)
  );
</script>

<div id="result">
  {$fragmentResult.data?.usersConnectionSnapshot.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($fragmentResult.pageInfo)}
</div>

<button id="next" on:click={() => fragmentResult.loadNextPage()}>next</button>
