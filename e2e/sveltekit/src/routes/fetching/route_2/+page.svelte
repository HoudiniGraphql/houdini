<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  $: ({ fetching_route_1 } = data);

  $: console.info(`fetching_route_2 - fetching: ${$fetching_route_1.fetching}`);
</script>

<pre>{JSON.stringify($fetching_route_1, null, 2)}</pre>
