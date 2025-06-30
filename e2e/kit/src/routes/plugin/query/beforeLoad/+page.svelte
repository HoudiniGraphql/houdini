<script lang="ts">
  import type { PageData } from './$houdini';
  import { graphql } from '$houdini';

  export let data: PageData;

  $: ({ PreprocessorBeforeLoadTestQuery: result } = data);
</script>

<div id="result">
  {data.message}: {$result.data?.user.name}
</div>
