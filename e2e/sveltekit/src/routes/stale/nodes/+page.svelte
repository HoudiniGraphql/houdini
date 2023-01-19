<script>
  import { graphql } from '$houdini';
  const store = graphql(`
    query UserNodes_FeatStale {
      userNodes(limit: 3, snapshot: "UserNodes_FeatStale") {
        totalCount
        nodes {
          id
          name
        }
      }
    }
  `);

  $: console.log(`$store`, $store);
</script>

<h4>Total count</h4>
<div id="result">
  {$store.data?.userNodes.totalCount}
</div>
<h4>Info first 3</h4>
{#each $store.data?.userNodes.nodes ?? [] as user}
  <div>{user?.name}</div>
{/each}
