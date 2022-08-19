<script lang="ts">
  import { routes } from '$lib/utils/routes';

  let status: number | null = null;
  async function add() {
    const result = await fetch(routes.Stores_Endpoint_Mutation, { method: 'POST' });
    status = result.status;
  }
</script>

<h1>endpoint-mutation</h1>

<button id="mutate" on:click={add}>Add User</button>

<div id="result">
  {status}
</div>
