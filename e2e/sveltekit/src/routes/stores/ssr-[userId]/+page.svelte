<script lang="ts">
  import { CachePolicy } from '$houdini';
  import { page } from '$app/stores';
  import { stry } from '@kitql/helper';
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ User } = data);

  async function refresh(id: string | null) {
    if (id) {
      await User.fetch({ variables: { id, tmp: false } });
    } else {
      // context not usefull here, but we can put it!
      await User.fetch({ policy: CachePolicy.NetworkOnly });
    }
  }

  async function refresh2WithVariableDifferentOrder() {
    await User.fetch({ variables: { tmp: false, id: '2' } });
  }
</script>

<h1>SSR - [userId: {$page.params.userId}]</h1>

<button id="refresh-null" on:click={() => refresh(null)}>Fetch (no variable)</button>
<button id="refresh-1" on:click={() => refresh('1')}>Fetch 1</button>
<button id="refresh-2" on:click={() => refresh('2')}>Fetch 2</button>
<button id="refresh-77" on:click={() => refresh('77')}>Fetch 77</button>
<button id="refresh-2Star" on:click={() => refresh2WithVariableDifferentOrder()}>Fetch 2*</button>

{#if $User.isFetching}
  <p>Loading...</p>
{:else if $User.errors}
  <pre>
    {stry($User.errors)}
  </pre>
{:else}
  <div id="result">
    {$User.data?.user.id} - {$User.data?.user.name}
  </div>
{/if}
