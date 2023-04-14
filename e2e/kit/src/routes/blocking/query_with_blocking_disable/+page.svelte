<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ query_with_blocking_disable } = data);
</script>

<h2>query_with_blocking_disable</h2>
<div id="result">
  {$query_with_blocking_disable.data?.user.id}-{$query_with_blocking_disable.data?.user.name}
</div>
