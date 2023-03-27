<script lang="ts">
  import type { PageData } from '../query_with_unblocking/$houdini';

  export let data: PageData;

  $: ({ query_with_unblocking } = data);
</script>

<h2>query_with_unblocking</h2>
<div id="result">
  {$query_with_unblocking.data?.user.id}-{$query_with_unblocking.data?.user.name}
</div>
