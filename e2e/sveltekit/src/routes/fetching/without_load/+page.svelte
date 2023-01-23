<script lang="ts">
  import { graphql } from '$houdini';

  const store = graphql`
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
