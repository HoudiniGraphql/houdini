<script lang="ts">
  import { graphql, MutationUpdateFragmentIncStore } from '$houdini';
  import { stry } from '@kitql/helper';
  import type { PageData } from './$types';
  import Component from './Component.svelte';

  export let data: PageData;

  $: ({ MutationUpdateFragment } = data);

  const increment: MutationUpdateFragmentIncStore = graphql`
    mutation MutationUpdateFragmentInc {
      mutationUpdateFragmentInc {
        ...MutationUpdateFragmentFragment
      }
    }
  `;

  $: pageCounter = ($MutationUpdateFragment.data?.mutationUpdateFragmentData as any)?.data;
</script>

<h1>Mutation update with fragment</h1>

<button on:click={() => increment.mutate(null)}>Increment counter</button>

<p>Data (<code>+page.svelte</code>):</p>
<pre>{stry($MutationUpdateFragment)}</pre>
<p>Counter (<code>+page.svelte</code>): <span id="counter-page">{pageCounter}</span></p>

{#if $MutationUpdateFragment.data?.mutationUpdateFragmentData}
  <Component data={$MutationUpdateFragment.data.mutationUpdateFragmentData} />
{/if}
