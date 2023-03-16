<script lang="ts">
  import type { PageData } from './$houdini';
  import AbstractFragmentTestChild from './Child.svelte';

  export let data: PageData;

  $: ({ AbstractQueryTest } = data);
</script>

<div id="result">
  <AbstractFragmentTestChild user={$AbstractQueryTest.data?.node} />
</div>
