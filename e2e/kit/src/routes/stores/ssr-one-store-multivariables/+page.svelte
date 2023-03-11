<script lang="ts">
  import { MultiUserStore } from '$houdini';
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ store1, store2 } = data);

  const checkTypes = () => {
    return (
      `${data.store1 instanceof MultiUserStore} ` +
      `- ${data.store2 instanceof MultiUserStore} ` +
      // @ts-ignore
      `- ${data.store3 instanceof MultiUserStore}`
    );
  };
</script>

<h1>ssr-one-store-multivariables</h1>

<div id="result">
  {$store1.data?.user.id} - {$store1.data?.user.name}
</div>

<div id="result-5">
  {$store2.data?.user.id} - {$store2.data?.user.name}
</div>

<div id="result-types">
  {checkTypes()}
</div>
