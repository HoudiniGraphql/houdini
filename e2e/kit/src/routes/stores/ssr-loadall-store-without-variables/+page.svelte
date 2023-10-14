<script lang="ts">
  import { HelloStore } from '$houdini';
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ Hello } = data);

  const checkTypes = () => {
    return `${data.Hello instanceof HelloStore}`;
  };
</script>

<h1>ssr-loadall-store-without-variables</h1>

<div id="result">
  {$Hello.data?.hello}
</div>

<div id="result-types">
  {checkTypes()}
</div>
