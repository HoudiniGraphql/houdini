<script lang="ts">
  import { graphql } from '$houdini';
  import type { Svelte5ComponentQueryVariables } from './$houdini';

  const { id }: { id: string } = $props();

  export const _Svelte5ComponentQueryVariables: Svelte5ComponentQueryVariables = ({ props }) => {
    return {
      id: props.id
    };
  };

  const result = graphql(`
    query Svelte5ComponentQuery($id: ID!) @load {
      user(id: $id, snapshot: "svelte-5-component") {
        name
      }
    }
  `);
</script>

{$result.data?.user.name}
