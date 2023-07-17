<script lang="ts">
  import type { PageData } from './$houdini';
  import UserDetails from './UserDetails.svelte';

  export let data: PageData;
  $: ({ ComponentInRoute_Route } = data);
</script>

{#if $ComponentInRoute_Route.data}
  <ul>
    {#each $ComponentInRoute_Route.data.usersList as user}
      <UserDetails userId={user.id} />
    {/each}
  </ul>
{/if}
