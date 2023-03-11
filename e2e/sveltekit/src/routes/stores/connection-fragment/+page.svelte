<script lang="ts">
  import { fragment, graphql } from '$houdini';

  $: queryResult = graphql(`
    query UserConnectionFragmentQuery @load {
      user(id: "1", snapshot: "connection-fragment") {
        friendsConnection(first: 2) {
          ...ConnectionFragment
        }
      }
    }
  `);

  $: frag = fragment(
    $queryResult.data?.user?.friendsConnection ?? null,
    graphql(`
      fragment ConnectionFragment on UserConnection {
        edges {
          node {
            name
          }
        }
      }
    `)
  );
</script>

<div id="result">
  {$frag?.edges.map(({ node }) => node?.name).join(', ')}
</div>
