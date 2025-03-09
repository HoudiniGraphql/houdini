<script lang="ts">
  import { fragment, graphql, type UserSearch } from '$houdini';

  export let data: UserSearch;
  $: _frag = fragment(
    data,
    graphql(`
      fragment UserSearch on Query @arguments(name: { type: "String", default: "test" }) {
        userSearch(filter: { name: $name }, snapshot: "") {
          id
          name
        }
      }
    `)
  );
</script>

<pre>
    {JSON.stringify($_frag, undefined, 2)}
</pre>
