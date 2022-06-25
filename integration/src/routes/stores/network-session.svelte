<script lang="ts">
  import { getHoudiniContext, GQL_Session } from '$houdini';

  const context = getHoudiniContext();

  async function getToken() {
    GQL_Session.fetch({
      context
    });
  }
</script>

<h1>Network Session</h1>

<button id="getToken" on:click={getToken}>Get Token</button>

<div id="result">
  {$GQL_Session.data?.session}
</div>
