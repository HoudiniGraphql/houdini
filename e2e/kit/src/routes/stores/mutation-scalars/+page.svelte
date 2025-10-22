<script lang="ts">
  import { UpdateUserStore } from '$houdini';
  import { stringify } from '$lib/utils/stringify';

  const updateUser = new UpdateUserStore();

  async function update() {
    await updateUser.mutate({
      id: '6',
      birthDate: new Date('1986-11-07')
    });
  }
</script>

<h1>Mutation update</h1>

<button id="mutate" on:click={update}>Update User</button>

<div id="result">
  {stringify($updateUser.data)}
</div>
