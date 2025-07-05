<script lang="ts">
  import { graphql } from '$houdini';
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ LayoutTestQuery: result} = data)
</script>

<div id="result">
  {$result.data?.user.name}
</div>

<slot />
