<script lang="ts">
  import { graphql } from '$houdini';
  import type { PageData } from './$houdini';

  export let data: PageData

  $: ({PreprocessorTestQueryVars: result} = data);
</script>

<div id="result">
  {$result?.data?.user.name}
</div>

<div id="variables">
  {JSON.stringify($result?.variables)}
</div>
