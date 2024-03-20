<script lang="ts">
  import { graphql } from '$houdini';
  import type { PageData } from './$houdini';

  export let data: PageData;
  $: ({ UsersListMutationInsertUsers } = data);

  const addUserMutation = graphql(`
    mutation UsersListMutationInsertAddUser($name: String!) {
      addUser(
        name: $name
        birthDate: "2024-01-01T00:00:00Z"
        snapshot: "users-list-mutation-insert"
      ) {
        id
        ...MyList_insert @with(someParam: true) @prepend
      }
    }
  `);

  const addUser = async () => {
    addUserMutation.mutate({
      name: 'Test User'
    });
  };
</script>

<button id="addusers" on:click={addUser}>+ Add</button>

<div id="result">
  {#if $UsersListMutationInsertUsers.data}
    <ul>
      {#each $UsersListMutationInsertUsers.data.usersConnection.edges as userEdge}
        <li>{userEdge.node?.name} - {userEdge.node?.testField}</li>
      {/each}
    </ul>
  {/if}
</div>
