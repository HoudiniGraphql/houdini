<script lang="ts">
  import { CachePolicy, graphql } from '$houdini';

  $: result = graphql(`
    query BidirectionalCursorSinglePagePaginationQuery @load {
      usersConnection(
        after: "YXJyYXljb25uZWN0aW9uOjE="
        first: 2
        snapshot: "pagination-query-bidiriectional-cursor-single-page"
      ) @paginate {
        edges {
          node {
            name
          }
        }
      }
    }
  `);
</script>

<div id="result">
  {$result.data?.usersConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($result.pageInfo)}
</div>

<button id="previous" on:click={() => result.fetch({ variables: { before: $result.pageInfo.startCursor, last: 2, first: null, after: null } })}>previous</button>
<button id="next" on:click={() => result.fetch({ variables: { after: $result.pageInfo.endCursor, first: 2, last: null, before: null } })}>next</button>

<button id="refetch" on:click={() => result.fetch({ policy: CachePolicy.NetworkOnly })}
  >refetch</button
>
