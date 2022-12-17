<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ Hello, InlineAndGlobalLoadQuery2 } = data);
  $: console.log('data', data);
</script>

<div id="result">
  {$Hello.data?.hello},{$InlineAndGlobalLoadQuery2.data?.user.id}
</div>
