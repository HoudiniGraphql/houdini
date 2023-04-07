<script lang="ts">
  import { LoadingValue } from '$houdini';
  import type { PageData } from './$houdini';
  export let data: PageData;

  $: ({ LoadingStateTestQuery } = data);
  $: user = $LoadingStateTestQuery.data?.user!;
</script>

<div id="result">
  {#if user.name === LoadingValue}
    loading!
  {:else}
    not loading
  {/if}
</div>
