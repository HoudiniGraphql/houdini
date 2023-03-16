<script lang="ts">
  import { fragment, graphql, type AnimalsList } from '$houdini';

  export let connection: AnimalsList;
  $: data = fragment(
    connection,
    graphql(`
      fragment AnimalsList on AnimalConnection {
        edges {
          node {
            id
            name
          }
        }
      }
    `)
  );
</script>

<pre>{JSON.stringify($data, undefined, 2)}</pre>
