<script lang="ts">
  import { CachePolicy, UserResultStore } from '$houdini';
  import { stringify } from '$lib/utils/stringify';

  export let id: string;

  const userResult = new UserResultStore();

  async function getUser() {
    await userResult.fetch({
      variables: { id, forceMessage: false },
      policy: CachePolicy.NetworkOnly
    });
  }
</script>

<button id="getUser" on:click={getUser}>GET User</button>

<pre>{stringify($userResult?.data, null, 2)}</pre>
