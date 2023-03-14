<script lang="ts">
  import type { PageData } from './$houdini';
  import UserItem from './UserItem.svelte';

  export let data: PageData;
  $: ({ ListUsers } = data);
</script>

{#if $ListUsers.data}
  <ul>
    {#each $ListUsers.data.usersConnection.edges as userEdge}
      {@const user = userEdge.node}
      {#if user}
        <UserItem {user} />
      {/if}
    {/each}
  </ul>
{/if}
