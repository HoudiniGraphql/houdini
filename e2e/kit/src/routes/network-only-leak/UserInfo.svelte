<script lang="ts">
  import { graphql } from '$houdini';

  export let id;

  $: info = graphql(`
    query UserInfoLeakQuery($id: ID!) @load {
      user(id: $id, snapshot: "leak-test") @cache(policy: NetworkOnly) {
        id
      }
    }
  `);

  export function _UserInfoLeakQueryVariables({ props }: { props: { id: string } }) {
    return {
      id: props.id
    };
  }
</script>

<div>
  {$info.data?.user.id}
</div>
