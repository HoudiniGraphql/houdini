<script lang="ts">
  import type { PageData } from './$types';
  import User from './User.svelte';

  export let data: PageData;

  $: ({ NestedFragmentArgs } = data);
</script>

<pre>
    {JSON.stringify($NestedFragmentArgs, undefined, 2)}
</pre>

{#if $NestedFragmentArgs.data}
  <User data={$NestedFragmentArgs.data} />
{/if}
