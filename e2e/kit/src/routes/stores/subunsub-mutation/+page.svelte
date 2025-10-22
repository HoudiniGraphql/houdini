<script lang="ts">
  import { UpdateUserSubUnsubStore } from '$houdini';

  const updateUserSubUnsub = new UpdateUserSubUnsubStore();

  async function mutate() {
    await updateUserSubUnsub.mutate({
      id: '1',
      name: 'JYC & Alec!'
    });
  }
</script>

<h1>Sub Unsub - Mutation</h1>

<button id="mutate" on:click={() => mutate()}>Mutate</button>
