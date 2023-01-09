<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;
</script>

<div id="result">
  {data.fancyMessage},{data.errorMessage}
</div>
