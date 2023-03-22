<script lang="ts">
  import { fragment, graphql, type UserListItem } from '$houdini';

  export let user: UserListItem;
  $: data = fragment(
    user,
    graphql(`
      fragment UserListItem on User {
        id
        name
        enumValue
      }
    `)
  );
</script>

{#if $data}
  <li>
    {$data.name} - {$data.enumValue}
  </li>
{/if}
