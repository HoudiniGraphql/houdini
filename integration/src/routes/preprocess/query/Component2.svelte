<script context="module" lang="ts">
  export function ComponentRouteQueryVariables({ props }: { props: { id?: string } }) {
    return {
      id: props.id || '3'
    };
  }
</script>

<script lang="ts">
  import { query, graphql, type ComponentRouteQuery } from '$houdini';

  // svelte-ignore unused-export-let
  export let id = '';

  const { data } = query<ComponentRouteQuery>(graphql`
    query ComponentRouteQuery($id: ID!) {
      user(id: $id, snapshot: "component-route") {
        name
      }
    }
  `);
</script>

{$data?.user.name}
