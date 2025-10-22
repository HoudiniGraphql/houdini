<script lang="ts">
  import { CachePolicy, UserNodesResultStore } from '$houdini';

  const userNodesResult = new UserNodesResultStore();

  async function getAllUsers() {
    await userNodesResult.fetch({
      variables: { forceMessage: false },
      policy: CachePolicy.CacheAndNetwork
    });
  }
</script>

<button id="getAllUsers" on:click={getAllUsers}>GET AllUsers</button>

<div id="result">
  <pre>{JSON.stringify($userNodesResult?.data, null, 2)}</pre>
</div>
