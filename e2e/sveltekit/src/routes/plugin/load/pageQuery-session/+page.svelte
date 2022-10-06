<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;

  $: ({ PageQuerySession } = data);
</script>

<h1>SSR Session</h1>

<div id="result">
  {$PageQuerySession.data?.session}
</div>
