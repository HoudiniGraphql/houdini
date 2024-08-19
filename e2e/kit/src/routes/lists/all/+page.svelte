<script lang="ts">
  import { goto, invalidate } from '$app/navigation';
  import { page } from '$app/stores';
  import { GQL_ListAll_AddUser } from '$houdini';
  import { onMount } from 'svelte';
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ ListAll } = data);

  let limit = parseInt($page.url.searchParams.get('limit') ?? '1', 10);

  onMount(() => {
    updateQS();
  });

  async function updateQS() {
    const newUrl = new URL($page.url);
    newUrl.searchParams.set('limit', limit.toString());
    await invalidate(newUrl);
    await goto(newUrl, { replaceState: true, keepFocus: true });
  }

  const add = async () => {
    await GQL_ListAll_AddUser.mutate(null);
  };
</script>

<input type="number" bind:value={limit} />
<br />
<br />
<button on:click={add}>Add User</button>

<h2>List</h2>
<div id="result">
  {#each $ListAll.data?.userNodes.nodes ?? [] as user}
    <div>{user?.name}</div>
  {/each}
</div>
