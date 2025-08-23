<script lang="ts">
  import { UserNameStore, type UserName } from '$houdini';
  import Loading from './Loading.svelte';

  export let user: UserName | undefined;

  $: data = user && new UserNameStore().get(user);
</script>

{#if $data}
  {$data.name}
{:else}
  <Loading />
{/if}
