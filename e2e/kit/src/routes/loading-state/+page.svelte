<script lang="ts">
  import { PendingValue } from '$houdini';
  import type { PageData } from './$houdini';
  export let data: PageData;
  import CityInfoWithLoadingState from './CityInfoWithLoadingState.svelte';

  $: ({ LoadingStateTestQuery } = data);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  $: city = $LoadingStateTestQuery.data!.city!;
</script>

<div class="city">
  <h1>
    {#if city.name === PendingValue}
      loading...
    {:else}
      {city.name}
    {/if}
  </h1>
  <div>
    <CityInfoWithLoadingState {city} />
  </div>
</div>
