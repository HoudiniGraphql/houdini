<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ SingleLoadQuery } = data);
</script>

<div id="result">
  {$SingleLoadQuery.data?.user.id}
</div>
