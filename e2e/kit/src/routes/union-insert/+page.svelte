<script lang="ts">
  import { graphql } from '$houdini';
  import type { PageData } from './$types';
  import { stringify } from '$lib/utils/stringify';

  export let data: PageData;

  $: ({ AorB } = data);

  const addA = graphql(`
    mutation CreateA($a: String!) {
      createA(a: $a) {
        ...All_AorB_insert
      }
    }
  `);

  const addB = graphql(`
    mutation CreateB($b: String!) {
      createB(b: $b) {
        ...All_AorB_insert
      }
    }
  `);
</script>

<button id="addA" on:click={() => addA.mutate({ a: 'MyA' })}>Add A</button>
<button id="addB" on:click={() => addB.mutate({ b: 'MyB' })}>Add B</button>

<div id="result">
  <pre>{stringify($AorB?.data, null, 0)}</pre>
</div>
