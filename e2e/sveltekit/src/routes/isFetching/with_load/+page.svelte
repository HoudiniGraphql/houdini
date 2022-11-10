<script lang="ts">
  import { graphql } from '$houdini';

  const store = graphql`
    query isFetching_w {
      user(id: 1, snapshot: "isFetching_w", delay: 200) {
        id
        name
      }
    }
  `;

  $: console.log(`with_load - isFetching: ${$store.isFetching}`);
</script>

<pre>{JSON.stringify($store, null, 2)}</pre>
