<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;

  $: ({ LoadingStateTestQuery } = data);
</script>

<div id="fetching">
  {JSON.stringify($LoadingStateTestQuery.fetching)}
</div>

<div id="result">
  {JSON.stringify($LoadingStateTestQuery.data, null, 4)}
</div>
