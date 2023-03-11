<script lang="ts">
  import type { PageData } from './$houdini';
  import { graphql } from '$houdini';

  export let data: PageData;

  $: result = graphql(`
    query PreprocessorBeforeLoadTestQuery @load {
      user(id: "1", snapshot: "preprocess-before-load-test-simple") {
        name
      }
    }
  `);
</script>

<div id="result">
  {data.message}: {$result.data?.user.name}
</div>
