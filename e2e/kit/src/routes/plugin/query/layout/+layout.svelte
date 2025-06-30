<script lang="ts">
  import { graphql } from '$houdini';
  import { PageData } from './$houdini';

  export let data: PageData;

  $: ({ LayoutTestQuery: result} = data)
</script>

<div id="result">
  {$result.data?.user.name}
</div>

<slot />
