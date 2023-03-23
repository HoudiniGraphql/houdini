<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;

  $: ({ PreprocessorOnErrorTestQueryLog } = data);
</script>

<pre>{$PreprocessorOnErrorTestQueryLog}</pre>

<div id="result">check the console log</div>
