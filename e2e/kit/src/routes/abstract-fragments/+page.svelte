<script lang="ts">
  import type { PageData } from './$houdini';
  import TestAnimal from './AnimalsList.svelte';

  export let data: PageData;
  $: ({ TestQuery } = data);
</script>

data:
<pre>{JSON.stringify($TestQuery.data, undefined, 2)}</pre>

{#if $TestQuery.data?.monkeys}
  fragment:
  <TestAnimal connection={$TestQuery.data?.monkeys} />
{/if}
