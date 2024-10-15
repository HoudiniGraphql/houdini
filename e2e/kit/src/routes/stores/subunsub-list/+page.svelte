<script lang="ts">
  import { GQL_UsersListSubUnSub } from '$houdini';
  import { onMount } from 'svelte';

  onMount(() => {
    GQL_UsersListSubUnSub.fetch();
  });
</script>

<h1>Sub Unsub - List</h1>

<ul>
  {#each $GQL_UsersListSubUnSub.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>
