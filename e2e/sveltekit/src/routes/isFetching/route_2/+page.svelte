<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  $: ({ isFetching_route_1 } = data);

  $: console.info(`isFetching_route_2 - isFetching: ${$isFetching_route_1.isFetching}`);
</script>

<pre>{JSON.stringify($isFetching_route_1, null, 2)}</pre>
