<script lang="ts">
  import { page } from '$app/stores';
  import { stry } from '@kitql/helpers';
  import type { PageData } from './$types';

  export let data: PageData;

  $: ({ User } = data);
</script>

<h1>Prefetch - [userId: {$page.params.userId}]</h1>

<a data-sveltekit-preload-data="hover" id="previous" href="/stores/prefetch-1">Previous</a>
<a data-sveltekit-preload-data="hover" id="current" href="/stores/prefetch-2">Current (n° 2)</a>
<a data-sveltekit-preload-data="hover" id="next" href="/stores/prefetch-3">Next</a>

<div id="result">
  <pre>
    {stry($User, 0)}
  </pre>
</div>
