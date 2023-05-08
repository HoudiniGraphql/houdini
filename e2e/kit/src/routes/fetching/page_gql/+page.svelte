<script lang="ts">
  import type { PageData } from '../route_3/$houdini';

  export let data: PageData;

  $: ({ fetching_page_gql } = data);

  $: console.info(`fetching_page_gql - fetching: ${$fetching_page_gql.fetching}`);
</script>

<pre>{JSON.stringify($fetching_page_gql, null, 2)}</pre>
