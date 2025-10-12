<script lang="ts">
  import { graphql } from '$houdini';
  import type { PageData } from './$houdini'

  export let data: PageData;
  $: ({ PreprocessorTestQuery1: result } = data);
</script>

<div id="result">
  {$result.data?.user.name}
</div>
