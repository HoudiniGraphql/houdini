<script lang="ts">
  import { browser } from '$app/environment';
  import { GQL_Hello, GQL_usersList } from '$houdini';

  $: browser && GQL_usersList.fetch();
  $: browser && GQL_Hello.fetch();
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
