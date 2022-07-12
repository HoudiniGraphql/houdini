<script lang="ts">
  import { GQL_Style3 } from '$houdini';
  import Style3 from '$lib/mix/style3.svelte';
  import type { Load } from '@sveltejs/kit';

  export const load: Load = async (event)=> {
    // Call style 3 here to enable SSR!
    // Seems to not work.
    await GQL_Style3.fetch({ event });
    return {};
  }  
</script> 

  
<div id="result">
  <Style3 />
</div>
  