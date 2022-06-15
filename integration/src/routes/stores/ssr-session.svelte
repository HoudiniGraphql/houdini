<script context="module" lang="ts">
  import { GQL_Session } from '$houdini';
  import type { LoadEvent } from '@sveltejs/kit';

  export async function load(event: LoadEvent) {
    await GQL_Session.prefetch({ event });
    return {};
  }
</script>

<h1>SSR Session</h1>

<div id="result">
  {$GQL_Session.data?.session}
</div>
