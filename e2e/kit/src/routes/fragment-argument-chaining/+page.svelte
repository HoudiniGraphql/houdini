<script lang="ts">
  import { fragment, graphql } from '$houdini';
  import { onMount } from 'svelte';

  $: store = graphql(`
    query AAA($name: String! = "will") {
      ...Frag1 @with(name: $name) @mask_disable
    }
  `);

  $: frag1 = fragment(
    $store.data,
    graphql(`
      fragment Frag1 on Query @arguments(name: { type: "String!" }) {
        user(id: "1", snapshot: "fragment-arguments-chaining") {
          ...Frag2 @with(userFilter: { name: $name }) @mask_disable
          #   ...Frag2 @with(name: $name) @mask_disable
        }
      }
    `)
  );

  $: frag2 = fragment(
    $frag1?.user,
    graphql(`
      fragment Frag2 on User @arguments(userFilter: { type: "UserNameFilter!" }) {
        userSearch(filter: $userFilter, snapshot: "fragment-arguments-chaining") {
          #   fragment Frag2 on User @arguments(name: { type: "String!" }) {
          #     userSearch(filter: { name: $name }, snapshot: "fragment-arguments-chaining") {
          id
          name
        }
      }
    `)
  );

  onMount(() => {
    store.fetch();
  });
</script>

<h2>Store data:</h2>
{#if $store.data}
  <pre>{JSON.stringify($store.data, null, 2)}</pre>
{/if}

<h2>Fragment 1 data:</h2>
<pre>{JSON.stringify($frag1?.user, null, 2)}</pre>

<h2>Fragment 2 data:</h2>
<pre>{JSON.stringify($frag2?.userSearch, null, 2)}</pre>
