<script context="module" lang="ts">
  import { browser } from '$app/env';
  import { afterNavigate, beforeNavigate, invalidate } from '$app/navigation';
  import { page } from '$app/stores';
  import { getHoudiniContext, GQL_User, type User$input } from '$houdini';
  import { stry } from '@kitql/helper';
  import type { LoadEvent } from '@sveltejs/kit';
  import { navigating } from '$app/stores';
  import { get } from 'svelte/store';
  // import { get } from 'svelte/store';

  let isNavigating: any = null;

  // navigating.subscribe((val) => (isNavigating = val));

  let variables: User$input;
  export async function load(event: LoadEvent) {
    //event.prefetch
    variables = { id: event.params.userId };
    await GQL_User.fetch({ event, variables });
    console.log(`coucou load`);
    // if (browser) {
    //   let ttt = get(navigating);
    //   console.log(`ttt`, ttt);
    // }
    // console.log(isNavigating);
    return {
      cache: {
        maxage: 10
      }
    };
  }
</script>

<script lang="ts">
</script>

<h1>SSR - [userId: {$page.params.userId}]</h1>
<!-- {$navigating} -->
<a sveltekit:prefetch id="previous" href="/stores/prefetch-1">Previous</a>
<a sveltekit:prefetch id="current" href="/stores/prefetch-2">Current (n° 2)</a>
<a sveltekit:prefetch id="next" href="/stores/prefetch-3">Next</a>

<div id="result">
  <pre>
    {stry($GQL_User, 0)}
  </pre>
</div>
