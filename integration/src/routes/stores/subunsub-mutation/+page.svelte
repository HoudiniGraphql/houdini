<script lang="ts">
  import { GQL_UpdateUserSubUnsub } from '$houdini';
  async function mutate() {
    await GQL_UpdateUserSubUnsub.mutate({
      id: '1',
      name: 'JYC & Alec!'
    });
  }
</script>

<h1>Sub Unsub - Mutation</h1>

<button id="mutate" on:click={() => mutate()}>Mutate</button>
