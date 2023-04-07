<script lang="ts">
  import { fragment, graphql, type CityInfoWithLoadingState, LoadingValue } from '$houdini';

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
