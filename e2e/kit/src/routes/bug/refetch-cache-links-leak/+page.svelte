<script lang="ts">
  import { cache, graphql } from '$houdini';
  import { onMount } from 'svelte';

  const store = graphql(`
    query TestingOneUser($id: ID!) {
      user(id: $id, snapshot: "testing") {
        friendsConnection {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  `);

  // Count only the embedded edge records so the test has a stable signal.
  // Before the fix, refetching with CacheAndNetwork would double this count
  // because each write generated new keys instead of reusing existing ones.
  const edgeLinkCount = $derived(
    $store.fetching
      ? -1
      : Object.keys(
          cache._internal_unstable._internal_unstable.storage.data[0].links
        ).filter((k) => k.includes('.friendsConnection.edges[')).length
  );

  onMount(() => {
    store.fetch({ variables: { id: '2' }, policy: 'CacheAndNetwork' });
  });

  const refetch = () => {
    store.fetch({ variables: { id: '2' }, policy: 'CacheAndNetwork' });
  };
</script>

<button id="refetch" onclick={() => refetch()}>refetch data</button>

{#if $store.fetching}
  <p>Loading...</p>
{:else}
  <div id="result">{JSON.stringify($store.data)}</div>
{/if}

<div id="edge-link-count">{edgeLinkCount}</div>
