<!--
To reproduce:
1. open this page
2. wait for data to be loaded
3. click "refresh links" on the right. notice how there's 8 "User:testing:2.friendsConnection.edges[x]" links
4. click "refetch data" on the left.
5. click "refresh links" on the right. notice how there's now 16 "User:testing:2.friendsConnection.edges[x]" links

This only happens when the refetch query has to fetch new data from the network and write it to the cache.
Using "NoCache" or "CacheOrNetwork" as policies avoid this behavior.
Additionally, this only happens with connections. If we'd use the `friendsList` list instead, this behavior disappears.
-->

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

  let links = $state<object>({});

  onMount(() => {
    store.fetch({
      variables: { id: '2' },
      policy: 'CacheAndNetwork'
    });
  });

  const refetch = () => {
    store.fetch({
      variables: { id: '2' },
      policy: 'CacheAndNetwork'
    });
  };

  const refreshLinks = () => {
    links = cache._internal_unstable._internal_unstable.storage.data[0].links;
  };
</script>

<div class="cols">
  <div class="col">
    <button onclick={() => refetch()}>refetch data</button>

    {#if $store.fetching}
      <p>Loading...</p>
    {:else}
      <pre>{JSON.stringify($store.data, null, 2)}</pre>
    {/if}
  </div>
  <div class="col">
    <button onclick={() => refreshLinks()}>refresh links</button>
    <p>Links: ({Object.keys(links).length})</p>
    <pre>{JSON.stringify(links, null, 2)}</pre>
  </div>
</div>

<style>
  .cols {
    display: flex;
    gap: 1em;

    .col {
      flex: 1;
    }
  }
</style>
