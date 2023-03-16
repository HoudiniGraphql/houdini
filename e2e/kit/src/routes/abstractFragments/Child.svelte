<script lang="ts">
  import { fragment, graphql, type AbstractFragmentTestChild } from '$houdini';

  export let user: AbstractFragmentTestChild | undefined | null;

  $: data = fragment(
    user,
    graphql(`
      fragment AbstractFragmentTestChild on Node {
        id
      }
    `)
  );
</script>

{$data?.id}
