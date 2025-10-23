<script lang="ts">
  import { CachePolicy, UserNodesResultStore } from '$houdini';
  import { stringify} from '$lib/utils/stringify'

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
  <pre>{stringify($userNodesResult?.data)}</pre>
</div>
