<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;

  $: ({ PageQuery } = data);
</script>

<div id="result">
  {$PageQuery.data?.user.id}
</div>
