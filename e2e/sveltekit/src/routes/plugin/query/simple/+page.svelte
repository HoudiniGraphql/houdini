<script lang="ts">
  import { graphql } from '$houdini';

  $: result = graphql(`
    query PreprocessorTestQuery1 @load {
      user(id: "1", snapshot: "preprocess-query-simple") {
        name
      }
    }
  `);
</script>

<div id="result">
  {$result.data?.user.name}
</div>
