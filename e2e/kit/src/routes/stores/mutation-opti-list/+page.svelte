<script lang="ts">
  import { graphql } from '$houdini';

  $: query = graphql(`
    query OptimisticUsersList @load {
      usersList(snapshot: "mutation-opti-list", limit: 15) @list(name: "OptimisticUsersList") {
        name
      }
    }
  `);

  const addUser = graphql(`
    mutation AddUserOptiList($name: String!, $birthDate: DateTime!) {
      addUser(name: $name, birthDate: $birthDate, delay: 1000, snapshot: "mutation-opti-list") {
        ...OptimisticUsersList_insert
      }
    }
  `);

  async function add() {
    await addUser.mutate(
      { name: 'JYC', birthDate: new Date('1986-11-07') },
      {
        optimisticResponse: {
          addUser: {
            id: '??? id ???',
            name: '...optimisticResponse... I could have guessed JYC!'
          }
        }
      }
    );
  }
</script>

<h1>Mutation Opti List</h1>

<button id="mutate" on:click={add}>Add User</button>

<div id="result">
  {$query.data?.usersList.map((user) => user.name).join(', ')}
</div>
