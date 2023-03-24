<script lang="ts">
  import { graphql } from '$houdini';

  // we have to setup @no_blocking here as the global throwOnError will make every query blocking otherwise
  const store = graphql(`
    query fetching_w @load @no_blocking {
      user(id: 1, snapshot: "fetching_w", delay: 200) {
        id
        name
      }
    }
  `);

  $: console.info(`with_load - fetching: ${$store.fetching}`);
</script>

<pre>{JSON.stringify($store, null, 2)}</pre>
