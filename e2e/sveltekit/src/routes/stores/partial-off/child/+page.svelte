<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ PartialOffChild } = data);
  $: console.log($PartialOffChild.partial);
</script>

child:
<div id="result">
  {$PartialOffChild.data?.user.id}
</div>
<a href="/stores/partial-off"> parent </a>
