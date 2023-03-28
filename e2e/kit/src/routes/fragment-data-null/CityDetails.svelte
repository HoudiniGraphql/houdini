<script lang="ts">
  import { fragment, graphql, type CityDetails } from '$houdini';

  export let city: CityDetails;

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

<h3>inside CityDetails.svelte</h3>
{#if $data}
  <p>Libraries in {$data.name}:</p>
{/if}
<p>{JSON.stringify($data)}</p>
