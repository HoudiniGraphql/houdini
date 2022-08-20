<script lang="ts">
  import {
    paginatedFragment,
    graphql,
    query,
    type OffsetFragment,
    type UserFragmentOffsetQuery
  } from '$houdini';

  const queryResult = query<UserFragmentOffsetQuery>(graphql`
    query UserFragmentOffsetQuery {
      user(id: "1", snapshot: "pagination-fragment-offset") {
        ...OffsetFragment
      }
    }
  `);

  const fragmentResult = paginatedFragment<OffsetFragment>(
    $queryResult.data?.user ?? null,
    graphql`
      fragment OffsetFragment on User {
        friendsList(limit: 2) @paginate {
          name
        }
      }
    `
  );
</script>

<div id="result">
  {$fragmentResult.data.userData?.friendsList.map((node) => node?.name).join(', ')}
</div>

<button id="next" on:click={() => fragmentResult.loadNextPage()}>next</button>
