<script lang="ts">
  import { query, graphql, type PlusComponentRouteQuery } from '$houdini';

  // svelte-ignore unused-export-let
  export let id = '';

  export function PlusComponentRouteQueryVariables({ props }: { props: { id?: string } }) {
    return {
      id: props.id || '3'
    };
  }

  const result = query<PlusComponentRouteQuery>(graphql`
    query PlusComponentRouteQuery($id: ID!) {
      user(id: $id, snapshot: "component-route") {
        name
      }
    }
  `);
</script>

{$result.data?.user.name}
