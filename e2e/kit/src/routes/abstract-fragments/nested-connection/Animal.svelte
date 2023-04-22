<script lang="ts">
  import { fragment, graphql, type AnimalProps } from '$houdini';

  export let connection: AnimalProps;

  $: data = fragment(
    connection,
    graphql(`
      fragment AnimalProps on Animal {
        name
      }
    `)
  );
</script>

{$data.name}
