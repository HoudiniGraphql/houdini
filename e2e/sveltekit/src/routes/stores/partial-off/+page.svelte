<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;

  $: ({ PartialOff } = data);

  const partials: boolean[] = [];
  $: partials.push($PartialOff.partial);
</script>

parent:
<div id="result">
  {JSON.stringify(partials)}
</div>

<a href="/stores/partial-off/child" id="child"> child </a>
