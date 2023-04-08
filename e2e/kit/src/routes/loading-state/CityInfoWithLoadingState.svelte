<script lang="ts">
  import {
    fragment,
    fragmentFetching,
    graphql,
    LoadingValue,
    type CityInfoWithLoadingState
  } from '$houdini';

  export let city: CityInfoWithLoadingState;

  $: data = fragment(
    city,
    graphql(`
      fragment CityInfoWithLoadingState on City {
        id
        libraries @loading {
          id
          name
        }
      }
    `)
  );
  $: cityFetching = fragmentFetching(city);
</script>

<ul>
  {#each $data.libraries as library}
    <li>
      {#if library === LoadingValue}
        loading...
      {:else}
        {library?.name}
      {/if}
    </li>
  {/each}
</ul>

<div id="city-fetching">
  {cityFetching}
</div>
