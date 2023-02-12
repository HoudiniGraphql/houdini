<script lang="ts">
  import { fragment, graphql } from '$houdini';

  $: userInfo = graphql(`
    query FragmentUpdateTestQuery($id: ID!) @load {
      node(id: $id) {
        ... on User {
          ...UserFragmentTestFragment
        }
      }
    }
  `);

  $: user = fragment(
    $userInfo.data!.node!,
    graphql(`
      fragment UserFragmentTestFragment on User {
        name
      }
    `)
  );
</script>

<div id="result">{$user.name}</div>

<button id="refetch" on:click={() => userInfo.fetch({ variables: { id: 'preprocess-fragment:2' } })}
  >refetch</button
>
