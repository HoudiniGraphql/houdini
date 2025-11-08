<script lang="ts">
  import { fragment, graphql, type UserListItem } from '$houdini';

  export let user: UserListItem;
  $: data = fragment(
    user,
    graphql(`
      fragment UserListItem on User {
        id
        name
        avatarURL
        enumValue
      }
    `)
  );
</script>

{#if $data}
  <li>
  {$data.avatarURL}
    {$data.name} - {$data.enumValue}
  </li>
{/if}
