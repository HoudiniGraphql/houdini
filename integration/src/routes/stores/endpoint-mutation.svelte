<script lang="ts">
  import { GQL_AddUser } from '$houdini';
  import { stry } from '@kitql/helper';
  import { routes } from '$lib/utils/routes';

  let status: number | null = null;
  async function add() {
    const result = await fetch(routes.Stores_Endpoint_Mutation, { method: 'POST' });
    status = result.status;
  }
</script>

<h1>Mutation</h1>

<button id="mutate" on:click={add}>Add User</button>

<div id="result">
  {status}
</div>
