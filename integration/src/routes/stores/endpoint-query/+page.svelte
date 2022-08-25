<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;
</script>

<div id="result">
  {JSON.stringify({ data })}
</div>
