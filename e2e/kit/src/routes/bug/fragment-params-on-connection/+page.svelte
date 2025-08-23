<script lang="ts">
  import { graphql } from '$houdini';
  import { onMount } from 'svelte';
  import UsersList from './UsersList.svelte';
  import UserItem from './UserItem.svelte';

  $: store = graphql(`
    query Test {
      usersConnection(snapshot: "test-user", first: 5) {
        ...UsersListFragment @with(someParam: true)
        edges {
          node {
            ...UserItem @with(someParam: true)
          }
        }
      }
    }
  `);

  onMount(() => {
    store.fetch();
  });
</script>

{#if $store.data}
  <h3>With fragment on the connection:</h3>
  <UsersList usersList={$store.data.usersConnection} />

  <h3>With fragment on the node:</h3>
  <ul>
    {#each $store.data.usersConnection.edges as userEdge}
      <UserItem user={userEdge.node} />
    {/each}
  </ul>
{/if}
