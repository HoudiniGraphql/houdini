<script lang="ts">
  import { graphql, type PreprocessorTestQueryVarsStore } from '$houdini';

  const result: PreprocessorTestQueryVarsStore = graphql`
    query PreprocessorTestQueryVars($id: ID!) {
      user(id: $id, snapshot: "preprocess-query-variable") {
        name
      }
    }
  `;
</script>

<div id="result">
  {$result.data?.user.name}
</div>

<div id="variables">
  {JSON.stringify($result.variables)}
</div>
