<script lang="ts">
  import {
    fragment,
    graphql,
    query,
    type FragmentUpdateTestQuery,
    type UserFragmentTestFragment
  } from '$houdini';

  const { data, refetch } = query<FragmentUpdateTestQuery>(graphql`
    query FragmentUpdateTestQuery($id: ID!) {
      node(id: $id) {
        ... on User {
          ...UserFragmentTestFragment
        }
      }
    }
  `);

  let user = fragment<UserFragmentTestFragment>(
    $data?.node ?? null,
    graphql`
      fragment UserFragmentTestFragment on User {
        name
      }
    `
  );
</script>

<div id="result">{$user?.name}</div>

<button id="refetch" on:click={() => refetch({ id: 'preprocess-fragment:2' })}>refetch</button>
