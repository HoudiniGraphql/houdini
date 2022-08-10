<script lang="ts">
  import { GQL_Session } from '$houdini';

  async function getToken() {
    GQL_Session.fetch();
  }
</script>

<h1>Network Session</h1>

<button id="getToken" on:click={getToken}>Get Token</button>

<div id="result">
  {$GQL_Session.data?.session}
</div>
