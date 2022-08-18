<script lang="ts">
  import {
    paginatedFragment,
    graphql,
    query,
    type OffsetFragment,
    type UserFragmentOffsetQuery
  } from '$houdini';

  const { data } = query<UserFragmentOffsetQuery>(graphql`
    query UserFragmentOffsetQuery {
      user(id: "1", snapshot: "pagination-fragment-offset") {
        ...OffsetFragment
      }
    }
  `);

  const { data: userData, loadNextPage } = paginatedFragment<OffsetFragment>(
    $data ? $data.user : null,
    graphql`
      fragment OffsetFragment on User {
        friendsList(limit: 2) @paginate {
          name
        }
      }
    `,
  )
</script>

<div id="result">
  {$userData?.friendsList.map((node) => node?.name).join(', ')}
</div>

<button id="next" on:click={() => loadNextPage()}>next</button>
