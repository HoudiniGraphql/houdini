<script lang="ts">
  import { graphql, type PreprocessorTestQueryErrorStore } from '$houdini';

  const result: PreprocessorTestQueryErrorStore = graphql`
    query PreprocessorTestQueryError($id: ID!) @load {
      user(id: $id, snapshot: "preprocess-query-variable") {
        name
      }
    }
  `;
</script>

<div id="result">
  {$result.data?.user.name}
</div>
