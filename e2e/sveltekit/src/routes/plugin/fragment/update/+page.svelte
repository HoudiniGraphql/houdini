<script lang="ts">
  import {
    fragment,
    graphql,
    type FragmentUpdateTestQueryStore,
    type UserFragmentTestFragment
  } from '$houdini';

  const userInfo: FragmentUpdateTestQueryStore = graphql`
    query FragmentUpdateTestQuery($id: ID!) @load {
      node(id: $id) {
        ... on User {
          ...UserFragmentTestFragment
        }
      }
    }
  `;

  $: user = fragment<UserFragmentTestFragment>(
    $userInfo.data?.node ?? null,
    graphql`
      fragment UserFragmentTestFragment on User {
        name
      }
    `
  );
</script>

<div id="result">{$user?.name}</div>

<button id="refetch" on:click={() => userInfo.fetch({ variables: { id: 'preprocess-fragment:2' } })}
  >refetch</button
>
