<script context="module">
  export function FragmentUpdateTestQueryVariables() {
    return {
      id: 'preprocess-fragment:1'
    };
  }
</script>

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
    graphql`
      fragment UserFragmentTestFragment on User {
        name
      }
    `,
    // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
    $data?.node!
  );
</script>

<div id="result">{$user?.name}</div>

<button id="refetch" on:click={() => refetch({ id: 'preprocess-fragment:2' })}>refetch</button>
