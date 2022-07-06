<script context="module" lang="ts">
  export function PlusComponentRouteQueryVariables({ props }: { props: { id?: string } }) {
    return {
      id: props.id || '3'
    };
  }
</script>

<script lang="ts">
  import { query, graphql, type PlusComponentRouteQuery } from '$houdini';

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  export let id: string = '';

  const { data } = query<PlusComponentRouteQuery>(graphql`
    query PlusComponentRouteQuery($id: ID!) {
      user(id: $id, snapshot: "component-route") {
        name
      }
    }
  `);
</script>

{$data?.user.name}
