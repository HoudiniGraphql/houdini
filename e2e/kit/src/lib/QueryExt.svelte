<script lang="ts">
  import { browser } from '$app/environment';
  import { GQL_usersListComp } from '$houdini';

  $: browser && GQL_usersListComp.fetch();
</script>

<p id="QueryExt-result">
  Query Comp - Number of users: {JSON.stringify(
    $GQL_usersListComp.data?.usersList?.length,
    null,
    2
  )}
</p>
