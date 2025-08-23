<script lang="ts">
  import { CachePolicy, GQL_UserResult } from '$houdini';

  export let id: string;

  async function getUser() {
    await GQL_UserResult.fetch({
      variables: { id, forceMessage: false },
      policy: CachePolicy.NetworkOnly
    });
  }
</script>

<button id="getUser" on:click={getUser}>GET User</button>

<pre>{JSON.stringify($GQL_UserResult?.data, null, 2)}</pre>
