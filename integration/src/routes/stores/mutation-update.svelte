<script context="module" lang="ts">
  import { browser } from '$app/env';
  import { GQL_UpdateUser, GQL_usersList, type usersList$input } from '$houdini';
  import { stry } from '@kitql/helper';
  import type { LoadEvent } from '@sveltejs/kit';

  export async function load(event: LoadEvent) {
    const variables = { limit: 5 };
    await GQL_usersList.prefetch({ event, variables });
    return { props: { variables } };
  }
</script>

<script lang="ts">
  export let variables: usersList$input;

  $: browser && GQL_usersList.prefetch({ variables });

  async function update() {
    await GQL_UpdateUser.mutate({
      variables: { id: '5', name: 'tmp name update' }
    });
  }
  async function revert() {
    await GQL_UpdateUser.mutate({
      variables: { id: '5', name: 'Will Smith' }
    });
  }
</script>

<h1>Mutation update</h1>

<button id="mutate" on:click={update}>Update User</button>
<button id="revert" on:click={revert}>Reset User</button>

<ul>
  {#each $GQL_usersList.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>

<pre>
  {stry($GQL_UpdateUser)}
</pre>
