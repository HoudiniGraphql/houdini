<script lang="ts">
  import { graphql } from '$houdini';
  import CityDetails from './CityDetails.svelte';
  import type { PageData } from './$houdini';

  export let data: PageData

  $: ({ FragmentDataNullPageQuery: store} = data)
</script>

<h3>inside +page.svelte</h3>

{#if $store?.data}
  <p>{$store.data.city?.name} - id: {$store.data.city?.id}</p>
  <div id="result">
    <CityDetails city={$store.data.city} />
  </div>
{/if}
