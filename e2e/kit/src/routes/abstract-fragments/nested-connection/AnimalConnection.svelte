<script lang="ts">
  import { fragment, graphql, type AnimalConnectionProps } from '$houdini';
  import Animal from './Animal.svelte';

  export let connection: AnimalConnectionProps;
  $: data = fragment(
    connection,
    graphql(`
      fragment AnimalConnectionProps on AnimalConnection {
        edges {
          node {
            id
            ...AnimalProps
          }
        }
      }
    `)
  );
</script>

<div>
  Animal ids:
  {$data.edges?.map(({ node }) => node?.id).join(',')} &nbsp;&nbsp;&nbsp;&larr; this mysteriously works
  most of the time but failed me from time to time
</div>
<div>
  Animal names:
  <Animal connection={$data} /> &nbsp;&nbsp;&nbsp;&larr; this doesn't work
</div>
