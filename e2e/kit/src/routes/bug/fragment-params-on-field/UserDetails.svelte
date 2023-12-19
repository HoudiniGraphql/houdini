<script lang="ts">
  import { fragment, graphql, type UserDetails } from '$houdini';
  import FriendInfo from './FriendInfo.svelte';

  export let user: UserDetails;

  $: userDetails = fragment(
    user,
    graphql(`
      fragment UserDetails on User @arguments(someParam: { type: "Boolean!" }) {
        id
        name
        friendsConnection {
          edges {
            node {
              ...FriendInfo @with(someParam: $someParam)
            }
          }
        }
      }
    `)
  );
</script>

<li>
  <p>{$userDetails.name}</p>
  <p>friends:</p>

  <ul>
    {#each $userDetails.friendsConnection.edges as friendEdge}
      {#if friendEdge.node}
        <FriendInfo user={friendEdge.node} />
      {/if}
    {/each}
  </ul>
</li>
