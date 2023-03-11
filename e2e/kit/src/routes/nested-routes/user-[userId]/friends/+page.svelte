<script lang="ts">
  import Loading from '../../Loading.svelte';
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ Page_User_Firends } = data);
</script>

<h4>Tab: Number of Fiends</h4>

{#if $Page_User_Firends.data?.user?.friendsConnection.edges}
  {$Page_User_Firends.data?.user.friendsConnection.edges.length}
{:else}
  <Loading />
{/if}
