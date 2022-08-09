<script lang="ts">
  import { page } from '$app/stores';
  import type { Data } from './$types';
  import { stry } from '@kitql/helper';

  export let data: Data;

  $: ({ User } = data);
</script>

<h1>Prefetch - [userId: {$page.params.userId}]</h1>

<a sveltekit:prefetch id="previous" href="/stores/prefetch-1">Previous</a>
<a sveltekit:prefetch id="current" href="/stores/prefetch-2">Current (n° 2)</a>
<a sveltekit:prefetch id="next" href="/stores/prefetch-3">Next</a>

<div id="result">
  <pre>
    {stry($User, 0)}
  </pre>
</div>
