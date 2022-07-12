<script lang="ts">
  import { graphql, query, type Style3 } from '$houdini';
  import UserStyle2 from '$lib/mix/userStyle2.svelte';

  const { data } = query<Style3>(graphql`
    query Style3 {
      usersList(snapshot: "style3") {
        ...UserStyle2
      }
    }
  `);
</script>

<div id="result">
  <ul>
    {#each $data?.usersList ?? [] as user}
      <UserStyle2 {user} />
    {/each}
  </ul>
</div>
