<script lang="ts">
  import { query, graphql, type PreprocessorTestQueryVars } from '$houdini';

  const { data, variables } = query<PreprocessorTestQueryVars>(graphql`
    query PreprocessorTestQueryVars($id: ID!) {
      user(id: $id, snapshot: "preprocess-query-variable") {
        name
      }
    }
  `);
</script>

<div id="result">
  {$data?.user.name}
</div>

<div id="variables">
  {JSON.stringify($variables)}
</div>
