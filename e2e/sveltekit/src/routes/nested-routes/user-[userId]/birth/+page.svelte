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
