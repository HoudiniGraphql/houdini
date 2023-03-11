<script lang="ts">
  import { browser } from '$app/environment';
  import { CachePolicy, GQL_Session, GQL_UpdateUserSubUnsub } from '$houdini';

  async function mutate() {
    await GQL_UpdateUserSubUnsub.mutate(
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

  $: browser &&
    GQL_Session.fetch({
      metadata: { logResult: true },
      policy: CachePolicy.NetworkOnly // to enforce a new fetch (even if it's alreay in cache somewhere else)
    });
</script>

<h1>Metadata</h1>

<div id="result">
  {$GQL_Session.data?.session}
</div>

<button id="mutate" on:click={() => mutate()}>Mutate</button>
