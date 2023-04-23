<script lang="ts">
  import { fragment, graphql, type AnimalNameProps } from '$houdini';

  export let props: AnimalNameProps;
  $: data = fragment(
    props,
    graphql(`
      fragment AnimalNameProps on Animal {
        name
      }
    `)
  );
</script>

<div>
  Name:
  {$data.name}
  &nbsp;&nbsp;&nbsp;&larr; this doesn't work for me
</div>
