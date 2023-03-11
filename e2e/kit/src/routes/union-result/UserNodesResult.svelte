<script lang="ts">
  import { CachePolicy, GQL_UserNodesResult } from '$houdini';

  async function getAllUsers() {
    await GQL_UserNodesResult.fetch({
      variables: { forceMessage: false },
      policy: CachePolicy.CacheAndNetwork
    });
  }
</script>

<button id="getAllUsers" on:click={getAllUsers}>GET AllUsers</button>

<div id="result">
  <pre>{JSON.stringify($GQL_UserNodesResult?.data, null, 2)}</pre>
</div>
