<script lang="ts">
  import { browser } from '$app/environment';
  import { GQL_UsersListSubUnSub } from '$houdini';

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
