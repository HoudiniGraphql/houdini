<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ query_with_no_blocking } = data);
</script>

<h2>query_with_no_blocking</h2>
<div id="result">
  {$query_with_no_blocking.data?.user.id}-{$query_with_no_blocking.data?.user.name}
</div>
