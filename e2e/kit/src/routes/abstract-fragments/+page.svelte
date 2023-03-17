<script lang="ts">
  import type { PageData } from './$houdini';
  import TestAnimal from './AnimalsList.svelte';

  export let data: PageData;
  $: ({ MonkeyListQuery } = data);
</script>

data:
<pre>{JSON.stringify($MonkeyListQuery, undefined, 2)}</pre>

{#if $MonkeyListQuery.data?.monkeys}
  <div id="result">
    <TestAnimal connection={$MonkeyListQuery.data?.monkeys} />
  </div>
{/if}
