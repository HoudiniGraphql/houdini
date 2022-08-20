<script lang="ts">
  export let message = '';

  import { query, graphql, type PreprocessorTestQuery1 } from '$houdini';

  $:({ data } = query<PreprocessorTestQuery1>(graphql`
    query PreprocessorAfterLoadTestQuery {
      user(id: "1", snapshot: "preprocess-after-load-test-simple") {
        name
      }
    }
  `));
</script>

<div id="result">
  {message}: {$data?.user.name}
</div>
