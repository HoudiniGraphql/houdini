<script lang="ts">
  import type { PageData } from './$houdini';
  import TestAnimal from './ArticlesList.svelte';

  export let data: PageData;
  $: ({ Articles } = data);
</script>

data:
<pre>{JSON.stringify($Articles, undefined, 2)}</pre>

{#if $Articles.data?.articles}
  <div id="result">
    <TestAnimal articles={$Articles.data?.articles} />
  </div>
{/if}
