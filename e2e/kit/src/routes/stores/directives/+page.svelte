<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;
  $: ({ Directives } = data);
</script>

<div id="result">{JSON.stringify($Directives.data)}</div>
