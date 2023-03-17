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
          }
        }
      }
    `)
  );
</script>

{$data.edges.map(({ node }) => node?.id).join(',')}
