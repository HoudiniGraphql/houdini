<script context="module" lang="ts">
  export function PreprocessorTestQueryVarsVariables({ params }: { params: { id?: string } }) {
    return {
      id: params.id || '1'
    };
  }
</script>

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
