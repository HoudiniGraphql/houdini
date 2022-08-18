<script lang="ts">
  import type { PageData } from './$types';
  
  export let data: PageData;

  $: ({Session} = data)
</script>

<h1>SSR Session</h1>

<div id="result">
  {$Session.data?.session}
</div>
