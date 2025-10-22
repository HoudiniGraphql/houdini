<script lang="ts">
  import { usersListCompStore } from '$houdini';
  import { onMount } from 'svelte';

  const usersListComp = new usersListCompStore();

  onMount(() => {
    usersListComp.fetch();
  });
</script>

<p id="QueryExt-result">
  Query Comp - Number of users: {JSON.stringify(
    $usersListComp.data?.usersList?.length,
    null,
    2
  )}
</p>
