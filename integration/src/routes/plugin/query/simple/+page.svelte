<script lang="ts">
  import { query, graphql, type PreprocessorTestQuery1 } from '$houdini';

  const result = query<PreprocessorTestQuery1>(graphql`
    query PreprocessorTestQuery1 {
      user(id: "1", snapshot: "preprocess-query-simple") {
        name
      }
    }
  `);
</script>

<div id="result">
  {$result.data?.user.name}
</div>
