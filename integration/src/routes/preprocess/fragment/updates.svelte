<script context="module">
  export function FragmentUpdateTestQueryVariables() {
    return {
      id: '1'
    };
  }
</script>

<script lang="ts">
  import {
    fragment,
    graphql,
    query,
    type UserFragmentTestFragment,
    type FragmentUpdateTestQuery
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

  const user = fragment<UserFragmentTestFragment>(
    graphql`
      fragment UserFragmentTestFragment on User {
        name
      }
    `,
    $data!.node!
  );
</script>

<div id="result">{$user?.name}</div>

<button id="refetch" on:click={() => refetch({ id: '2' })}>refetch</button>
