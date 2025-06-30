<script lang="ts">
  import { graphql } from '$houdini';
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ PreprocessorAfterLoadTestQuery: result } = data);
</script>

<div id="result">
  {data.message}: {$result.data?.user.name}
</div>
