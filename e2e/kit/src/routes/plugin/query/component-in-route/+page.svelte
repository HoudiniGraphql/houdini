<script lang="ts">
  import type { PageData } from './$houdini';
  import UserDetails from './UserDetails.svelte';

  export let data: PageData;
  $: ({ ComponentInRoute_Route } = data);
</script>

{#if $ComponentInRoute_Route.data}
  <ul>
    {#each $ComponentInRoute_Route.data.usersList as user}
      <li>
        <UserDetails userId={user.id.replace('ComponentInRoute:', '')} />
      </li>
    {/each}
  </ul>
{/if}
