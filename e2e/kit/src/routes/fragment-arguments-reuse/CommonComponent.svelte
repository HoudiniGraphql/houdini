<script lang="ts">
  import { fragment, graphql, type SearchUser } from '$houdini';

  export let user: SearchUser;

  $: data = fragment(
    user,
    graphql(`
      fragment SearchUser on User @arguments(search: { type: "String!" }) {
        userSearch(filter: { name: $search }, snapshot: "FragmentReuseSearch") {
          name
          birthDate
        }
      }
    `)
  );
</script>

<p>Component:</p>
<pre>{JSON.stringify($data, undefined, 2)}</pre>
