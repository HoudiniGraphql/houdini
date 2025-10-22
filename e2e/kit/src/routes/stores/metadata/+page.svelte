<script lang="ts">
  import { CachePolicy, SessionStore, UpdateUserSubUnsubStore } from '$houdini';
  import { onMount } from 'svelte';

  const session = new SessionStore();
  const updateUserSubUnsub = new UpdateUserSubUnsubStore();

  async function mutate() {
    await updateUserSubUnsub.mutate(
      {
        id: '5',
        name: 'Hello!'
      },
      {
        metadata: { logResult: true }
      }
    );
  }

  // there's nothing passing the session there to this fetch so the result is undefined

  onMount(() => {
    session.fetch({
      metadata: { logResult: true },
      policy: CachePolicy.NetworkOnly // to enforce a new fetch (even if it's alreay in cache somewhere else)
    });
  });
</script>

<h1>Metadata</h1>

<div id="result">
  {$session.data?.session}
</div>

<button id="mutate" on:click={() => mutate()}>Mutate</button>
