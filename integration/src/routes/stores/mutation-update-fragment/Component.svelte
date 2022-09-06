<script lang="ts">
  import { fragment, graphql, type MutationUpdateFragmentFragment } from '$houdini';
  import { stry } from '@kitql/helper';

  export let data: MutationUpdateFragmentFragment;

  $: fragmentData = fragment(
    data,
    graphql`
      fragment MutationUpdateFragmentFragment on MutationUpdateFragmentData {
        data
      }
    `
  );
</script>

<pre>{stry($fragmentData)}</pre>
