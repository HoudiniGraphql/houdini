<script lang="ts">
  import type { PageData } from './$houdini';
  import UserDetailsSvelte5 from './UserDetailsSvelte5.svelte';

  const { data }: {data: PageData} = $props();
  const { Svelte5UsersList } = $derived(data);
</script>

<div>
  {#if $Svelte5UsersList.data}
    <ul>
      {#each $Svelte5UsersList.data.usersConnection.edges as edge}
          <li>
              <UserDetailsSvelte5 user={edge.node!} />
          </li>
      {/each}
    </ul>
  {/if}

  <pre>{JSON.stringify($Svelte5UsersList.pageInfo, null, 2)}</pre>
  <button onclick={()=> Svelte5UsersList.loadNextPage()}>load more</button>
</div>
