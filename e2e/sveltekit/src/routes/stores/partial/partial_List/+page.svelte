<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;

  $: ({ Partial_List } = data);
</script>

<div id="result">
  {#each $Partial_List.data?.usersList ?? [] as { id, name }}
    {@const realId = id.split(':')[1]}
    <div>
      <a id={`f_${realId}`} href={`./partial_${realId}`}>Full</a>
      <a id={`l_${realId}`} href={`./partial_${realId}_Light`}>Light</a>
      <span>
        {id} - {name}
      </span>
    </div>
  {/each}
</div>
