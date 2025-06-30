<script lang="ts">
  import { graphql } from '$houdini';
  import { PageData } from './$houdini';

  export let data: PageData

  $: ({PreprocessorTestQueryVars: result} = $data);
</script>

<div id="result">
  {$result?.data?.user.name}
</div>

<div id="variables">
  {JSON.stringify($result?.variables)}
</div>
