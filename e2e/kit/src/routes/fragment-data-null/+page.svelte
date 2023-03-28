<script lang="ts">
  import { graphql } from '$houdini';
  import CityDetails from './CityDetails.svelte';

  $: store = graphql(`
    query Test @load {
      city(id: "1") {
        id
        name

        ...CityDetails
      }
    }
  `);
</script>

<h3>inside +page.svelte</h3>

{#if $store?.data}
  <p>{$store.data.city.name} - id: {$store.data.city.id}</p>
  <CityDetails city={$store.data.city} />
{/if}
