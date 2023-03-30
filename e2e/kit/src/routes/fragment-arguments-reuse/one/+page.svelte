<script lang="ts">
  import CommonComponent from '../CommonComponent.svelte';
  import type { PageData } from './$houdini';

  export let data: PageData;
  $: ({ FragmentsReuseQueryOne } = data);
</script>

{#if $FragmentsReuseQueryOne.data}
  <p>Query one user: {$FragmentsReuseQueryOne.data.user.name}</p>

  <CommonComponent user={$FragmentsReuseQueryOne.data.user} />
{/if}
