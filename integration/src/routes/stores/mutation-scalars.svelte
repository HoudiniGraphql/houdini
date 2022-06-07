<script context="module" lang="ts">
  import { GQL_usersList } from '$houdini';
  import type { LoadEvent } from '@sveltejs/kit';

  export async function load(event: LoadEvent) {
    await GQL_usersList.fetch({ event, variables: { limit: 5 } });
    return {};
  }
</script>

<script lang="ts">
  import { GQL_UpdateUser } from '$houdini';
  import { stry } from '@kitql/helper';

  async function update() {
    await GQL_UpdateUser.mutate({
      variables: { id: '5', birthDate: new Date('1986-11-07') }
    });
  }
</script>

<h1>Mutation update</h1>

<button id="mutate" on:click={update}>Update User</button>

<div id="result">
  {JSON.stringify($GQL_UpdateUser.data)}
</div>
