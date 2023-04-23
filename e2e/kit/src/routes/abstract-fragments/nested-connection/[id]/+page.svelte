<script lang="ts">
  import type { PageData } from './$houdini';
  import NestedMonkey from './NestedMonkey.svelte';

  export let data: PageData;
  $: ({ MonkeyDetailQuery } = data);
</script>

data:
<pre>{JSON.stringify($MonkeyDetailQuery, undefined, 2)}</pre>

{#if $MonkeyDetailQuery.data?.monkey}
  <div id="result">
    <NestedMonkey monkey={$MonkeyDetailQuery.data?.monkey} />
  </div>
{/if}
