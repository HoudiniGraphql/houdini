<script lang="ts">
  import { graphql } from '$houdini';

  export function _FragmentQueryVarsVariables({ props }: { props: { id?: string } }) {
    return {
      id: props.id || '3'
    };
  }

  // svelte-ignore unused-export-let
  export let id = '';

  const result = graphql(`
    query FragmentQueryVars($id: ID!) {
      user(id: $id, snapshot: "preprocess-query-variable") {
        name
      }
    }
  `);
</script>

{$result.data?.user.name}
