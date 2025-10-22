<script lang="ts">
  import { UsersListSubUnSubStore } from '$houdini';
  import { onMount } from 'svelte';

  const usersListSubUnSub = new UsersListSubUnSubStore();

  onMount(() => {
    usersListSubUnSub.fetch();
  });
</script>

<h1>Sub Unsub - List</h1>

<ul>
  {#each $usersListSubUnSub.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>
