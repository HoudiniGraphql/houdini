<script context="module">
  export function PreprocessorTestQueryVarsVariables({ params }: { params: { id?: string } }) {
    return {
      id: params.id || '1'
    };
  }
</script>

<script lang="ts">
  import { query, graphql, type PreprocessorTestQueryVars } from '$houdini';

  const { data } = query<PreprocessorTestQueryVars>(graphql`
    query PreprocessorTestQueryVars($id: ID!) {
      user(id: $id) {
        name
      }
    }
  `);
</script>

<div id="result">
  {$data?.user.name}
</div>
