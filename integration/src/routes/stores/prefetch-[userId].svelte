<script context="module" lang="ts">
  import { page } from '$app/stores';
  import { GQL_User, isBrowser } from '$houdini';
  import { stry } from '@kitql/helper';
  import type { LoadEvent } from '@sveltejs/kit';

  export async function load(event: LoadEvent) {
    let variables = { id: event.params.userId };
    await GQL_User.fetch({ event, variables });
    return {
      props: {
        variables
      }
    };
  }
</script>

<script lang="ts">
  export let variables = { id: 'default' };

  $: isBrowser && GQL_User.fetch({ variables });
</script>

<h1>Prefetch - [userId: {$page.params.userId}]</h1>

<a sveltekit:prefetch id="previous" href="/stores/prefetch-1">Previous</a>
<a sveltekit:prefetch id="current" href="/stores/prefetch-2">Current (n° 2)</a>
<a sveltekit:prefetch id="next" href="/stores/prefetch-3">Next</a>

<div id="result">
  <pre>
    {stry($GQL_User, 0)}
  </pre>
</div>
