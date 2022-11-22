<script lang="ts">
  import { graphql } from '$houdini';

  const store = graphql`
    query isFetching_wo @houdini(load: false) {
      user(id: 1, snapshot: "isFetching_wo", delay: 200) {
        id
        name
      }
    }
  `;

  const getData = () => {
    store.fetch();
  };

  $: console.info(`without_load - isFetching: ${$store.isFetching}`);
</script>

<button on:click={getData}>Fetch</button>

<pre>{JSON.stringify($store, null, 2)}</pre>
