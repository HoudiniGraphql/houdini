<script lang="ts">
  import { graphql } from '$houdini';

  $: result1 = graphql(`
    query PreprocessorTestQuery3 @load {
      user(id: "1", snapshot: "preprocess-query-multiple") {
        name
      }
    }
  `);

  $: result2 = graphql(`
    query PreprocessorTestQuery4 @load {
      user(id: "2", snapshot: "preprocess-query-multiple") {
        name
      }
    }
  `);
</script>

<div id="result1">
  {$result1.data?.user.name}
</div>
<div id="result2">
  {$result2.data?.user.name}
</div>
