<script lang="ts">
  import { browser } from '$app/env';
  import { getHoudiniContext, GQL_Session, GQL_UpdateUserSubUnsub } from '$houdini';

  const context = getHoudiniContext();

  async function mutate() {
    await GQL_UpdateUserSubUnsub.mutate({
      variables: {
        id: '5',
        name: 'Hello!'
      },
      metadata: { logResult: true }
    });
  }

  $: browser && GQL_Session.fetch({ context, metadata: { logResult: true } });
</script>

<h1>Metadata</h1>

<div id="result">
  {$GQL_Session.data?.session}
</div>

<button id="mutate" on:click={() => mutate()}>Mutate</button>
