<script lang="ts">
  import { fragment, graphql, type CityDetails } from '$houdini';
  import { stringify } from '$lib/utils/stringify.js'

  export let city: CityDetails | null;

  $: data = fragment(
    city,
    graphql(`
      fragment CityDetails on City {
        id
        name
        libraries {
          id
          name
        }
      }
    `)
  );
</script>

{#if $data}
  <p>{stringify($data)}</p>
{/if}
