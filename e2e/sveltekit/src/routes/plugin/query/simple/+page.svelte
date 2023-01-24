<script lang="ts">
  import { graphql, type PreprocessorTestQuery1Store } from '$houdini';

  const result: PreprocessorTestQuery1Store = graphql`
    query PreprocessorTestQuery1 @load {
      user(id: "1", snapshot: "preprocess-query-simple") {
        name
      }
    }
  `;
</script>

<div id="result">
  {$result.data?.user.name}
</div>
