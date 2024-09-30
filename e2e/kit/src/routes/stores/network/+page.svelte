<script lang="ts">
  import { GQL_Hello, GQL_usersList } from '$houdini';
  import { onMount } from 'svelte';

  onMount(() => {
    GQL_usersList.fetch();
    GQL_Hello.fetch();
  });
</script>

<h1>NETWORK</h1>

<ul>
  {#each $GQL_usersList.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>

<div id="result">
  {$GQL_Hello.data?.hello}
</div>
