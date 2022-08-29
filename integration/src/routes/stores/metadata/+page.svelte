<script lang="ts">
  import { browser } from '$app/environment';
  import { GQL_Session, GQL_UpdateUserSubUnsub } from '$houdini';

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

  $: browser && GQL_Session.fetch({ metadata: { logResult: true } });
</script>

<h1>Metadata</h1>

<div id="result">
  {$GQL_Session.data?.session}
</div>

<button id="mutate" on:click={() => mutate()}>Mutate</button>
