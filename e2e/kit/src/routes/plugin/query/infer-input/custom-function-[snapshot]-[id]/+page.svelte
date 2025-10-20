<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  let { CustomFunctionRouteParamsUserQuery } = data;
  $: ({ CustomFunctionRouteParamsUserQuery } = data);
</script>

<div id="result">
  {$CustomFunctionRouteParamsUserQuery.data?.user.name}
</div>
