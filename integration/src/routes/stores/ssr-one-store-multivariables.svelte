<script context="module" lang="ts">
  import { browser } from '$app/env';
  import { MultiUserStore, type MultiUser$input } from '$houdini';
  import type { LoadEvent } from '@sveltejs/kit';

  const u1 = MultiUserStore();
  const u5 = MultiUserStore();

  export async function load(event: LoadEvent) {
    const variables1 = { id: '1' };
    const variables5 = { id: '5' };

    await u1.prefetch({ event, variables: variables1 });
    await u5.prefetch({ event, variables: variables5 });

    return { props: { variables1, variables5 } };
  }
</script>

<script lang="ts">
  export let variables1: MultiUser$input;
  export let variables5: MultiUser$input;

  $: browser && u1.fetch({ variables: variables1 });
  $: browser && u5.fetch({ variables: variables5 });
</script>

<h1>ssr-one-store-multivariables</h1>

<div id="result">
  {$u1.data?.user.id} - {$u1.data?.user.name}
</div>

<div id="result-5">
  {$u5.data?.user.id} - {$u5.data?.user.name}
</div>
