<script lang="ts">
  import { graphql } from '$houdini';
  import { PageData } from './$houdini'

  export let data: PageData;
  $: ({ PreprocessorTestQuery1: result } = data);
</script>

<div id="result">
  {$result.data?.user.name}
</div>
