<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  $: ({ store1, store2 } = data);
</script>

<h1>ssr-one-store-multivariables</h1>

<div id="result">
  {$store1.data?.user.id} - {$store1.data?.user.name}
</div>

<div id="result-5">
  {$store2.data?.user.id} - {$store2.data?.user.name}
</div>
