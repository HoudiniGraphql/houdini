<script lang="ts">
  import { query, graphql, type PreprocessorTestQueryVars } from '$houdini';

  const result = query<PreprocessorTestQueryVars>(graphql`
    query PreprocessorTestQueryVars($id: ID!) {
      user(id: $id, snapshot: "preprocess-query-variable") {
        name
      }
    }
  `);
</script>

<div id="result">
  {$result.data?.user.name}
</div>

<div id="variables">
  {JSON.stringify($result.variables)}
</div>
