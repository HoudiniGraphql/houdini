<script lang="ts">
    import CommonComponent from '../CommonComponent.svelte';
    import type { PageData } from './$houdini';
  
    export let data: PageData;
    $: ({ FragmentsReuseQueryTwo } = data);
  </script>
  
  {#if $FragmentsReuseQueryTwo.data}
    <p>Query one user: {$FragmentsReuseQueryTwo.data.user.name}</p>
  
    <CommonComponent user={$FragmentsReuseQueryTwo.data.user} />
  {/if}
  