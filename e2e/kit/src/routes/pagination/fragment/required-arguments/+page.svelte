<script lang="ts">
  import { graphql, paginatedFragment } from '$houdini';

  $: queryResult = graphql(`
    query UserFragmentRequiredArgsQuery(
      $snapshot: String! = "pagination-fragment-required-arguments"
    ) @load {
      user(id: "1", snapshot: $snapshot) {
        id
        name

        ...TestFragment @with(snapshot: $snapshot)
      }
    }
  `);

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

<button id="next" on:click={() => fragmentResult.loadNextPage()}>next</button>
