<script lang="ts">
  import { graphql } from '$houdini';
  import type { ComponentInRoute_ComponentVariables } from './$houdini';

  export let userId: string;

  export const _ComponentInRoute_ComponentVariables: ComponentInRoute_ComponentVariables = ({
    props
  }) => {
    return {
      userId: props.userId
    };
  };

  $: details = graphql(`
    query ComponentInRoute_Component($userId: ID!) @load {
      user(id: $userId, snapshot: "ComponentInRoute") {
        name
      }
    }
  `);
</script>

{#if $details.data}
  {$details.data.user.name}
{/if}
