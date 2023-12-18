<script lang="ts">
  import { fragment, graphql, type UsersListFragment } from '$houdini';
  import UserItem from './UserItem.svelte';

  export let usersList: UsersListFragment;

  $: data = fragment(
    usersList,
    graphql(`
      fragment UsersListFragment on UserConnection @arguments(someParam: { type: "Boolean!" }) {
        edges {
          node {
            ...UserItem @with(someParam: $someParam)
          }
        }
      }
    `)
  );
</script>

<ul>
  {#each $data.edges as userEdge}
    <UserItem user={userEdge.node} />
  {/each}
</ul>
