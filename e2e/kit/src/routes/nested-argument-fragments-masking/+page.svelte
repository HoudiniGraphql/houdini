<script lang="ts">
  import type { PageData } from './$houdini';
  import UserDetails from './UserDetails.svelte';

  export let data: PageData;
  $: ({ Bug_UsersList } = data);
</script>

<div id="result">
  {#if $Bug_UsersList.data}
    <ul>
      {#each $Bug_UsersList.data.usersConnection.edges as userEdge}
        {#if userEdge.node}
          <UserDetails user={userEdge.node} />
        {/if}
      {/each}
    </ul>
  {/if}
</div>
