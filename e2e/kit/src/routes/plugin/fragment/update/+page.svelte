<script lang="ts">
  import { fragment, graphql } from '$houdini';
  import type { PageData } from './$houdini'

  export let data: PageData;

  $: ({FragmentUpdateTestQuery: userInfo } = data)

  $: user = fragment(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    $userInfo.data?.node,
    graphql(`
      fragment UserFragmentTestFragment on User {
        name
      }
    `)
  );
</script>

<div id="result">{$user?.name}</div>

<button id="refetch" on:click={() => userInfo.fetch({ variables: { id: 'preprocess-fragment:2' } })}
  >refetch</button
>
