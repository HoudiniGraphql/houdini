<script lang="ts">
  import { graphql } from '$houdini';

  $: store = graphql(`
    query AbstractInsert_UsersList @load {
      usersConnection(first: 1, snapshot: "abstract-insert") @list(name: "AbstractUsersList") {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `);

  const addUser = graphql(`
    mutation AbstractInsertAddUser($name: String!) {
      addUser(name: $name, snapshot: "abstract-insert", birthDate: 531747620000) {
        ...AbstractUsersList_insert
      }
    }
  `);

  let id = 0;

  const createMonkey = () => {
    addUser.mutate({ name: (id++).toString() });
  };
</script>

<div style="display:flex; flex-gap: 2rem;">
  <button id="insert" on:click={createMonkey}>Add User</button>
</div>

{#if $store.data}
  <div id="result">
    {#each $store.data.usersConnection.edges as animalEdge}
      {animalEdge.node?.name}
    {/each}
  </div>
{/if}
