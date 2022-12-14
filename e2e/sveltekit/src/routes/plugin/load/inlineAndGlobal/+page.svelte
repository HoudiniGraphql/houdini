<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;

  // TODO: fix the type issue
  $: ({ Hello, InlineAndGlobalLoadQuery2 } = data);
</script>

<div id="result">
  {$Hello.data?.hello},{$InlineAndGlobalLoadQuery2.data?.user.id}
</div>
