<script lang="ts">
  import { graphql,MutationUpdateFragmentIncStore } from '$houdini';
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
</script>

<h1>Mutation update with fragment</h1>

<button on:click={() => increment.mutate(null)}>Increment counter</button>

<p>Data (<code>+page.svelte</code>):</p>
<pre>{stry($MutationUpdateFragment)}</pre>

<p>Data (component):</p>
{#if $MutationUpdateFragment.data?.mutationUpdateFragmentData}
  <Component data={$MutationUpdateFragment.data.mutationUpdateFragmentData} />
{:else}
  <pre>-</pre>
{/if}
