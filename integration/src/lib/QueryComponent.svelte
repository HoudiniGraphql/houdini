<script context="module" lang="ts">
  export function FragmentQueryVarsVariables({ props }: { props: { id?: string } }) {
    console.log({ props });
    return {
      id: '1'
    };
  }
</script>

<script lang="ts">
  import { query, graphql, type FragmentQueryVars } from '$houdini';

  $: console.log('props changed:', $$props);
  export const id: string = '';

  const { data } = query<FragmentQueryVars>(graphql`
    query FragmentQueryVars($id: ID!) {
      user(id: $id, snapshot: "preprocess-query-variable") {
        name
      }
    }
  `);
</script>

{$data?.user.name}
