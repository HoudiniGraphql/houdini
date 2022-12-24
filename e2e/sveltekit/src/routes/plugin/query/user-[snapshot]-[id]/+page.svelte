<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;

  let { RouteParamsUserQuery } = data;
  $: ({ RouteParamsUserQuery } = data);
</script>

<div id="result">
  {$RouteParamsUserQuery.data?.user.name}
</div>
