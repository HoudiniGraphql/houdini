<script lang="ts">
  import { fragment, graphql, type UserSearch } from '$houdini';

  export let user: UserSearch;

  $: data = fragment(
    user,
    graphql(`
      fragment UserSearch on User @arguments(search: { type: "String!" }) {
        userSearch(filter: { name: $search }, snapshot: "UserSearch") {
          id
          name
        }
      }
    `)
  );
</script>

component:
{#if data}
  <pre>{JSON.stringify($data, undefined, 2)}</pre>
{/if}
