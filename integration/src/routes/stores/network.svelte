<script lang="ts">
  import { browser } from '$app/env';
  import { GQL_usersList } from '$houdini';

  $: browser && GQL_usersList.query({ context: {} });
</script>

<h1>NETWORK</h1>

<ul>
  {#each $GQL_usersList.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>
