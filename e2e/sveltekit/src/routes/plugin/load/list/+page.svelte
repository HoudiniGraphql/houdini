<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ ListLoadQuery1, ListLoadQuery2 } = data);
</script>

<div id="result">
  {$ListLoadQuery1.data?.user.id},{$ListLoadQuery2.data?.user.id}
</div>
