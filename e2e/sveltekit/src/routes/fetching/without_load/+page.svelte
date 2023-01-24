<script lang="ts">
  import { fetching_woStore, graphql } from '$houdini';

  const store = graphql<fetching_woStore>`
    query fetching_wo {
      user(id: 1, snapshot: "fetching_wo", delay: 200) {
        id
        name
      }
    }
  `;

  const getData = () => {
    store.fetch();
  };

  $: console.info(`without_load - fetching: ${$store.fetching}`);
</script>

<button on:click={getData}>Fetch</button>

<pre>{JSON.stringify($store, null, 2)}</pre>
