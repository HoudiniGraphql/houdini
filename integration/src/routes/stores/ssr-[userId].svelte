<script context="module" lang="ts">
  import { page, session } from '$app/stores';
  import { CachePolicy, GQL_user, getContext } from '$houdini';
  import { stry } from '@kitql/helper';
  import type { LoadEvent } from '@sveltejs/kit';

  export async function load(event: LoadEvent) {
    const id = event.params.userId;
    await GQL_user.fetch({ event, variables: { id } });
    return {};
  }
</script>

<script lang="ts">
  const context = getContext();

  async function refresh(id: string | null) {
    if (id) {
      await GQL_user.fetch({ variables: { id } });
    } else {
      await GQL_user.fetch({ policy: CachePolicy.NetworkOnly, context });
    }
  }
</script>

<h1>SSR - [userId: {$page.params.userId}]</h1>

<button id="refresh-null" on:click={() => refresh(null)}>Fetch (no variable)</button>
<button id="refresh-1" on:click={() => refresh('1')}>Fetch 1</button>
<button id="refresh-2" on:click={() => refresh('2')}>Fetch 2</button>
<button id="refresh-77" on:click={() => refresh('77')}>Fetch 7</button>

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
