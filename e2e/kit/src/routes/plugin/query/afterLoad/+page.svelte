<script lang="ts">
  import { graphql } from '$houdini';
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: result = graphql(`
    query PreprocessorAfterLoadTestQuery @load {
      user(id: "1", snapshot: "preprocess-after-load-test-simple") {
        name
      }
    }
  `);
</script>

<div id="result">
  {data.message}: {$result.data?.user.name}
</div>
