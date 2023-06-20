<script lang="ts">
  import type { PageData } from './$houdini';
  import ArticlesList from './ArticlesList.svelte';
  import OthersList from './OthersList.svelte';

  export let data: PageData;
  $: ({ Articles } = data);
</script>

data:
<pre>{JSON.stringify($Articles, undefined, 2)}</pre>

{#if $Articles.data?.articles && $Articles.data?.others}
  <div id="result">
    <ArticlesList articles={$Articles.data?.articles} />
    <OthersList others={$Articles.data?.others} />
  </div>
{/if}
