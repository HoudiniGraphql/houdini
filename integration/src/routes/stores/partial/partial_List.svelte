<script context="module" lang="ts">
  import { browser } from '$app/env';
  import { GQL_Partial_List } from '$houdini';
  import type { Load } from '@sveltejs/kit';

  export const load: Load<{}, {}, {}> = async (event) => {
    await GQL_Partial_List.fetch({ event });

    return {
      props: {}
    };
  };
</script>

<script lang="ts">
  $: browser && GQL_Partial_List.fetch();
</script>

<div id="result">
  {#each $GQL_Partial_List.data?.usersList ?? [] as { id, name }}
    {@const realId = id.split(':')[1]}
    <div>
      <a id={realId} href={`./partial_${realId}`}>
        {id} - {name}
      </a>
    </div>
  {/each}
</div>
