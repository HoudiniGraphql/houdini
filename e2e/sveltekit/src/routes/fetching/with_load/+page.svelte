<script lang="ts">
  import { graphql } from '$houdini';

  const store = graphql(`
    query fetching_w @load {
      user(id: 1, snapshot: "fetching_w", delay: 200) {
        id
        name
      }
    }
  `);

  $: console.info(`with_load - fetching: ${$store.fetching}`);
</script>

<pre>{JSON.stringify($store, null, 2)}</pre>
