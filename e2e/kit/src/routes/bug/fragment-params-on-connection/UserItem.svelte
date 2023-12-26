<script lang="ts">
  import { fragment, graphql, type UserItem } from '$houdini';

  export let user: UserItem | null;

  $: data = fragment(
    user,
    graphql(`
      fragment UserItem on User @arguments(someParam: { type: "Boolean!" }) {
        id
        name
        testField(someParam: $someParam)
      }
    `)
  );
</script>

<li>
  <p>{$data.id} - {$data.name}</p>
  <p>Test field: {$data?.testField}</p>
</li>
