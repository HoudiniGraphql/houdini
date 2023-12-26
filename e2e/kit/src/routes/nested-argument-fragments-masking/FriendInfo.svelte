<script lang="ts">
  import { fragment, graphql, type FriendInfo } from '$houdini';

  export let user: FriendInfo;

  $: friend = fragment(
    user,
    graphql(`
      fragment FriendInfo on User @arguments(someParam: { type: "Boolean!" }) {
        id
        name
        testField(someParam: $someParam)
      }
    `)
  );
</script>

<li>
  <p>{$friend.name}</p>
  <p>Test field: {$friend.testField}</p>
</li>
