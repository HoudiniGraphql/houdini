<script lang="ts">
  import { graphql } from '$houdini';

  export function _ComponentQueryTestVariables({ props }: { props: { id?: string } }) {
    return {
      id: props.id || '3'
    };
  }

  // svelte-ignore unused-export-let
  export let id = '';

  $: result = graphql(`
    query ComponentQueryTest($id: ID!) @load {
      user(id: $id, snapshot: "preprocess-query-variable") {
        name
      }
    }
  `);
</script>

{$result.data?.user.name}
