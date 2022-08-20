<script lang="ts">
  import { query, graphql, type FragmentQueryVars } from '$houdini';

  export function FragmentQueryVarsVariables({ props }: { props: { id?: string } }) {
    return {
      id: props.id || '3'
    };
  }

  // svelte-ignore unused-export-let
  export let id = '';

  const result = query<FragmentQueryVars>(graphql`
    query FragmentQueryVars($id: ID!) {
      user(id: $id, snapshot: "preprocess-query-variable") {
        name
      }
    }
  `);
</script>

{$result.data?.user.name}
