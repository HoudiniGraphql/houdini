<script lang="ts">
  import { graphql } from '$houdini';

  const mutation = graphql(`
    mutation MutationScalars_UpdateUser($id: ID!, $name: String, $birthDate: DateTime) {
      updateUser(
        id: $id
        name: $name
        birthDate: $birthDate
        snapshot: "MutationScalars_UpdateUser"
        delay: 1000
      ) {
        id
        name
        birthDate
      }
    }
  `);

  async function update() {
    await mutation.mutate({
      id: '6',
      birthDate: new Date('1986-11-07')
    });
  }
</script>

<h1>Mutation update</h1>

<button id="mutate" on:click={update}>Update User</button>

<div id="result">
  {JSON.stringify($mutation.data)}
</div>
