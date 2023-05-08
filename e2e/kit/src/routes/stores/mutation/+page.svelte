<script lang="ts">
  import { graphql } from '$houdini';
  import { stry } from '@kitql/helper';

  $: query = graphql(`
    query OptimisticUserQuery @load {
      user(id: "1", snapshot: "Mutation_UpdateUser") {
        name
      }
    }
  `);

  const mutation = graphql(`
    mutation Mutation_UpdateUser($id: ID!, $name: String, $birthDate: DateTime) {
      updateUser(
        id: $id
        name: $name
        birthDate: $birthDate
        snapshot: "Mutation_UpdateUser"
        delay: 1000
      ) {
        id
        name
        birthDate
      }
    }
  `);

  async function add() {
    await mutation.mutate(
      { id: '1', name: 'JYC', birthDate: new Date('1986-11-07') },
      {
        optimisticResponse: {
          updateUser: {
            id: 'Mutation_UpdateUser:1',
            name: '...optimisticResponse... I could have guessed JYC!'
          }
        }
      }
    );
  }
</script>

<h1>Mutation</h1>

<button id="mutate" on:click={add}>Add User</button>

<div id="result">
  {$query.data?.user.name}
</div>

<div id="store-value">
  {stry($mutation)}
</div>
