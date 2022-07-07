<script context="module" lang="ts">
  export function FragmentQueryVarsVariables({ props }: { props: { id?: string } }) {
    return {
      id: props.id || '3'
    };
  }
</script>

<script lang="ts">
  import { query, graphql, type FragmentQueryVars } from '$houdini';

  // svelte-ignore unused-export-let
  export let id = '';

  const { data } = query<FragmentQueryVars>(graphql`
    query FragmentQueryVars($id: ID!) {
      user(id: $id, snapshot: "preprocess-query-variable") {
        name
      }
    }
  `);
</script>

{$data?.user.name}
