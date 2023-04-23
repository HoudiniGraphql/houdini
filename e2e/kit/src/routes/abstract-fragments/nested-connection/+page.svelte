<script lang="ts">
  import { fragment, graphql } from '$houdini';
  import type { PageData } from './$houdini';
  import MonkeyList from './MonkeyList.svelte';

  export let data: PageData;
  $: ({ MonkeyListQueryForNesting } = data);

  $: initialFragmentData = fragment(
    $MonkeyListQueryForNesting.data?.monkeys,
    graphql(`
      fragment InitialData on MonkeyConnection {
        edges {
          node {
            id
          }
        }
      }
    `)
  );
</script>

data:
<pre>{JSON.stringify($MonkeyListQueryForNesting, undefined, 2)}</pre>

{#if $MonkeyListQueryForNesting.data?.monkeys}
  <div>
    Monkey ids: {$initialFragmentData?.edges?.map(({ node }) => node?.id).join(',')} &nbsp;&nbsp;&nbsp;&larr;
    this works
  </div>
  <MonkeyList connection={$MonkeyListQueryForNesting.data?.monkeys} />
{/if}
