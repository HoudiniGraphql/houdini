<script lang="ts">
  import { graphql } from '$houdini';
    import { onMount } from 'svelte';
  import UserSearch from './UserSearch.svelte';

  $: query = graphql(`
    query FragmentArguments($search: String! = "will") @load {
      user(id: "1", snapshot: "FragmentArguments") {
        id
        name
        ...UserSearch @with(search: $search)
      }
    }
  `);
</script>

<pre>{JSON.stringify($query.data, undefined, 2)}</pre>

{#if $query.data}
  <UserSearch user={$query.data.user} />
{/if}
