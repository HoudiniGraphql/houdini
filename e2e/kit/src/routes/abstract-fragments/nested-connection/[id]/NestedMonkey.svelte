<script lang="ts">
  import { fragment, graphql, type MonkeyDetail } from '$houdini';
  import AnimalName from './AnimalName.svelte';

  export let monkey: MonkeyDetail;
  $: data = fragment(
    monkey,
    graphql(`
      fragment MonkeyDetail on Monkey {
        hasBanana
        ...AnimalNameProps
      }
    `)
  );
  $: console.log({ $data });
</script>

{#if $data.hasBanana === undefined}
  This monkeys banana is undefined! Our data isn't working.
{:else}
  This monkey {$data.hasBanana ? 'has' : 'does not have'} a banana! &nbsp;&nbsp;&nbsp;&larr; this works
  for me
{/if}
<AnimalName props={$data} />
