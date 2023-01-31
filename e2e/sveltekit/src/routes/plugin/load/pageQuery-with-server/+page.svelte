<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;

  $: ({ PageQueryWithServer } = data);
</script>

<div id="result">
  {$PageQueryWithServer.data?.user.id}
</div>
