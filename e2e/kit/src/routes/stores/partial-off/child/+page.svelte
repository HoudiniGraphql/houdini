<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ PartialOffChild } = data);

  const partials: boolean[] = [];
  $: partials.push($PartialOffChild.partial);
</script>

child:
<div id="result">
  {JSON.stringify(partials)}
</div>
<a href="/stores/partial-off" id="parent"> parent </a>
