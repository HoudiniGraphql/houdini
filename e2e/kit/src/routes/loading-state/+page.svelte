<script lang="ts">
  import { LoadingValue } from '$houdini';
  import type { PageData } from './$houdini';
  export let data: PageData;
  import CityInfoWithLoadingState from './CityInfoWithLoadingState.svelte';

  $: ({ LoadingStateTestQuery } = data);
  $: city = $LoadingStateTestQuery.data!.city!;
</script>

<div class="city">
  <h1>
    {#if city.name === LoadingValue}
      loading...
    {:else}
      {city.name}
    {/if}
  </h1>
  <div>
    <CityInfoWithLoadingState {city} />
  </div>
</div>
