<script context="module" lang="ts">
  import { page } from '$app/stores';
  import { GQL_user } from '$houdini';
  import { stry } from '@kitql/helper';
  import type { LoadEvent } from '@sveltejs/kit';

  export async function load(event: LoadEvent) {
    const id = event.params.userId;
    await GQL_user.fetch({ event, variables: { id } });
    return {
      props: {
        variables: { id }
      }
    };
  }
</script>

<script lang="ts">
  export let variables: {};

  $: GQL_user.listen(variables);
</script>

<h1>SSR - [userId: {$page.params.userId}]</h1>

<a sveltekit:prefetch id="previous" href="/stores/prefetch-1">Previous</a>
<a sveltekit:prefetch id="current" href="/stores/prefetch-2">Current (n° 2)</a>
<a sveltekit:prefetch id="next" href="/stores/prefetch-3">Next</a>

<div id="result">
  <pre>
    {stry($GQL_user, 0)}
  </pre>
</div>
