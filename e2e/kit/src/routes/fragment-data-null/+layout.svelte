<script lang="ts">
  import { graphql } from '$houdini';

  $: store = graphql(`
    query LayoutCity @load {
      city(id: "1") {
        id
        name
        
        # ...CityDetails
      }
    }
  `);
</script>

<h3>inside +layout.svelte: (try disabling this query, or enabling <code>...CityDetails</code>)</h3>
<pre>{JSON.stringify($store.data, undefined, 2)}</pre>

<slot />
