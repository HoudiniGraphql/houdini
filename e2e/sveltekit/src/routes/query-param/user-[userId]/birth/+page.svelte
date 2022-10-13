<script lang="ts">
  import Loading from '../../Loading.svelte';
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ Page_User_Birth } = data);
</script>

<h4>Tab: Birth</h4>

{#if $Page_User_Birth.data?.user?.birthDate !== undefined}
  {$Page_User_Birth.data?.user.birthDate?.toISOString().split('T')[0]}
{:else}
  <Loading />
{/if}

<!-- 
  user.id is already resolved by some other places... we be instant
  isFetching is maybe a bit wrong
    - I have a delay of 1 sec and I'm in cacheOrNetwork mode
    - even if everything is on cache, I get a quick flickering of the loading state
    - if it hit the cache, isFetching should never go to true.
-->
{#if $Page_User_Birth.isFetching}
  <br />
  <br />
  <br />
  <br />
  {console.log('isFetching in the console... when everything is cached, it should not be logged!')}
{/if}
