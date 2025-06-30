<script lang="ts">
  import { fragment, graphql } from '$houdini';

  import { PageData } from './$houdini';

  export let data: PageData;

  $: ({ UserConnectonFragmentPageQuery: queryResult } = data);

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
