<script lang="ts">
  import { CachePolicy, graphql, paginatedFragment } from '$houdini';

  $: queryResult = graphql(`
    query UserFragmentBidirectionalCursorQuery @load {
      user(id: "1", snapshot: "pagination-fragment-backwards-cursor") {
        ...BidirectionalCursorFragment
      }
    }
  `);

  $: fragmentResult = paginatedFragment(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    $queryResult.data?.user,
    graphql(`
      fragment BidirectionalCursorFragment on User {
        usersConnection(after: "YXJyYXljb25uZWN0aW9uOjE=", first: 2) @paginate {
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
  {$fragmentResult.data?.usersConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($fragmentResult.pageInfo)}
</div>

<button id="previous" on:click={() => fragmentResult.loadPreviousPage()}>previous</button>
<button id="next" on:click={() => fragmentResult.loadNextPage()}>next</button>

<button id="refetch" on:click={() => fragmentResult.fetch({ policy: CachePolicy.NetworkOnly })}
  >refetch</button
>
