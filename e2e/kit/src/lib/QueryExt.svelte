<script lang="ts">
  import { GQL_usersListComp } from '$houdini';
  import { onMount } from 'svelte';

  onMount(() => {
    GQL_usersListComp.fetch();
  });
</script>

<p id="QueryExt-result">
  Query Comp - Number of users: {JSON.stringify(
    $GQL_usersListComp.data?.usersList?.length,
    null,
    2
  )}
</p>
