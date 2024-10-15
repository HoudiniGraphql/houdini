<script lang="ts">
  import { graphql } from '$houdini';
  import type { ComponentQueryTestVariables } from './$houdini';

  export const _ComponentQueryTestVariables: ComponentQueryTestVariables = ({ props }) => {
    return {
      id: props.id || '3'
    };
  };

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
