<script context="module" lang="ts">
  import { browser } from '$app/env';
  import { GQL_Hello, GQL_usersList, GQL_UsersListSubUnSub } from '$houdini';
</script>

<script lang="ts">
  $: browser && GQL_UsersListSubUnSub.fetch();
</script>

<h1>Sub Unsub - List</h1>

<ul>
  {#each $GQL_UsersListSubUnSub.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>
