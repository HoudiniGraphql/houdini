<script lang="ts">
  import { fragment, graphql, type MonkeyListProps } from '$houdini';
  import AnimalConnection from './AnimalConnection.svelte';

  export let connection: MonkeyListProps;
  $: data = fragment(
    connection,
    graphql(`
      fragment MonkeyListProps on MonkeyConnection {
        edges {
          node {
            hasBanana
          }
        }
        ...AnimalConnectionProps
      }
    `)
  );
</script>

<div>
  Has banana: {$data.edges?.map(({ node }) => node?.hasBanana).join(',')} &nbsp;&nbsp;&nbsp;&larr; this
  works
</div>
<AnimalConnection connection={$data} />
