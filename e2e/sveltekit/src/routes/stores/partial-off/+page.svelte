<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;

  $: ({ PartialOff } = data);
  $: console.info($PartialOff.partial);
</script>

parent:
<div id="result">
  {$PartialOff.data?.user.id}
</div>

<a href="/stores/partial-off/child"> child </a>
