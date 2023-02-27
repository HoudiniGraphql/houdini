<script lang="ts">
  import { CachePolicy, graphql } from '$houdini';

  $: result = graphql(`
    query BidirectionalCursorSinglePagePaginationQuery(
      $first: Int = 2
      $after: String = "YXJyYXljb25uZWN0aW9uOjE="
      $last: Int
      $before: String
    ) @load {
      usersConnection(
        first: $first
        after: $after
        last: $last
        before: $before
        snapshot: "pagination-query-bidiriectional-cursor-single-page"
      ) {
        edges {
          node {
            name
          }
        }
        pageInfo {
          endCursor
          hasNextPage
          hasPreviousPage
          startCursor
        }
      }
    }
  `);
</script>

<div id="result">
  {$result.data?.usersConnection.edges.map(({ node }) => node?.name).join(', ')}
</div>

<div id="pageInfo">
  {JSON.stringify($result.data?.usersConnection.pageInfo)}
</div>

<button
  id="previous"
  on:click={() =>
    result.fetch({
      variables: {
        last: 2,
        before: $result.data?.usersConnection.pageInfo.startCursor,
        first: null,
        after: null
      }
    })}
  disabled={!$result.data?.usersConnection.pageInfo.hasPreviousPage}
>
  previous
</button>
<button
  id="next"
  on:click={() =>
    result.fetch({
      variables: {
        last: null,
        before: null,
        after: $result.data?.usersConnection.pageInfo.endCursor,
        first: 2
      }
    })}
  disabled={!$result.data?.usersConnection.pageInfo.hasNextPage}
>
  next
</button>

<button id="refetch" on:click={() => result.fetch({ policy: CachePolicy.NetworkOnly })}>
  refetch
</button>
