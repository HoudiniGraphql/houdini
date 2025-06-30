<script lang="ts">
  import { graphql } from '$houdini';
  import type { PageData } from './$houdini'

  export let data: Data

  $: ({LayoutCity: store} = data)

</script>

<h3>inside +layout.svelte: (try disabling this query, or enabling <code>...CityDetails</code>)</h3>
<pre>{JSON.stringify($store.data, undefined, 2)}</pre>

<slot />
