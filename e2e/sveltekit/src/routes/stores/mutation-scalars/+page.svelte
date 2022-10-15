<script lang="ts">
  import { GQL_UpdateUser } from '$houdini';

  async function update() {
    await GQL_UpdateUser.mutate({
      id: '6',
      birthDate: new Date('1986-11-07')
    });
  }
</script>

<h1>Mutation update</h1>

<button id="mutate" on:click={update}>Update User</button>

<div id="result">
  {JSON.stringify($GQL_UpdateUser.data)}
</div>
