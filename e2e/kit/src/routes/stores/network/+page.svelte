<script lang="ts">
  import { HelloStore, usersListStore } from '$houdini';
  import { onMount } from 'svelte';

  const hello = new HelloStore();
  const usersList = new usersListStore();

  onMount(() => {
    usersList.fetch();
    hello.fetch();
  });
</script>

<h1>NETWORK</h1>

<ul>
  {#each $usersList.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>

<div id="result">
  {$hello.data?.hello}
</div>
