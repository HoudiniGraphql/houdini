<script lang="ts">
  import { graphql, query, type Style2 } from '$houdini';
  import UserStyle2 from '$lib/mix/userStyle2.svelte';

  const { data } = query<Style2>(graphql`
    query Style2 {
      usersList(snapshot: "style2") {
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
