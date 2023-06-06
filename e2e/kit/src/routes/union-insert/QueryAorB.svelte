<script lang="ts">
  import { CachePolicy, GQL_AorB } from '$houdini';

  async function getAllAorB() {
    await GQL_AorB.fetch({
      policy: CachePolicy.CacheAndNetwork
    });
  }
</script>

<button id="getAllAorB" on:click={getAllAorB}>GET AorB</button>

<div id="result">
  <pre>{JSON.stringify($GQL_AorB?.data, null, 2)}</pre>
</div>
