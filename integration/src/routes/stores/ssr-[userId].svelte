<script context="module" lang="ts">
  import { browser } from '$app/env';
  import { page } from '$app/stores';
  import { CachePolicy, getHoudiniContext, GQL_user, type user$input } from '$houdini';
  import { stry } from '@kitql/helper';
  import type { LoadEvent } from '@sveltejs/kit';

  export async function load(event: LoadEvent) {
    const variables = { id: event.params.userId };
    await GQL_user.prefetch({ event, variables });
    return { props: { variables } };
  }
</script>

<script lang="ts">
  export let variables: user$input;
  const context = getHoudiniContext();

  $: browser && GQL_user.fetch({ variables });

  async function refresh(id: string | null) {
    if (id) {
      await GQL_user.fetch({ variables: { id, tmp: false } });
    } else {
      // context not usefull here, but we can put it!
      await GQL_user.fetch({ context, policy: CachePolicy.NetworkOnly });
    }
  }

  async function refresh2WithVariableDifferentOrder() {
    await GQL_user.fetch({ variables: { tmp: false, id: '2' } });
  }
</script>

<h1>SSR - [userId: {$page.params.userId}]</h1>

<button id="refresh-null" on:click={() => refresh(null)}>Fetch (no variable)</button>
<button id="refresh-1" on:click={() => refresh('1')}>Fetch 1</button>
<button id="refresh-2" on:click={() => refresh('2')}>Fetch 2</button>
<button id="refresh-77" on:click={() => refresh('77')}>Fetch 77</button>
<button id="refresh-2Star" on:click={() => refresh2WithVariableDifferentOrder()}>Fetch 2*</button>

{#if $GQL_user.isFetching}
  <p>Loading...</p>
{:else if $GQL_user.errors}
  <pre>
    {stry($GQL_user.errors)}
  </pre>
{:else}
  <p>
    {$GQL_user.data?.user.id} - {$GQL_user.data?.user.name}
  </p>
{/if}
