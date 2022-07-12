<script lang="ts">
  import { query, graphql, type Style1 } from '$houdini';

  const { data } = query<Style1>(graphql`
    query Style1 {
      usersList(snapshot: "style1") {
          id
          name
      }
    }
  `);
</script> 
  
<div id="result">
  <ul>
    {#each $data?.usersList ?? [] as {id, name}}
      <li>{id} - {name}</li>
    {/each}
  </ul>
</div>
  