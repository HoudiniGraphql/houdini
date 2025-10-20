<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  let { OptionalRouteParamsUserQuery } = data;
  $: ({ OptionalRouteParamsUserQuery } = data);
</script>

<div id="result">
  {$OptionalRouteParamsUserQuery.data?.user.name}
</div>
