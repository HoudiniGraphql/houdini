<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { AliasStore } from '$houdini';
  import { stry } from '@kitql/helper';

  const store = new AliasStore();

  $: browser && store.fetch({ variables: { limit: Number($page.params.limit), first: 1 } });
</script>

<h1>alias - [limit: {$page.params.limit}]</h1>

<a id="previous" href="/alias-1">limit 1</a>
<a id="current" href="/alias-2">limit 2</a>
<a id="next" href="/alias-3">limit 3</a>

<div id="result">
  <pre>
    {stry($store.data)}
  </pre>
</div>
