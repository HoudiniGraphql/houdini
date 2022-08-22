<script lang="ts">
  import { GQL_UpdateUser } from '$houdini';
  import { stry } from '@kitql/helper';
  import type { PageData } from './$types';

  export let data: PageData;

  $: ({ usersList } = data);

  async function update() {
    await GQL_UpdateUser.mutate({
      id: '5',
      name: 'tmp name update'
    });
  }
  async function revert() {
    await GQL_UpdateUser.mutate({
      id: '5',
      name: 'Will Smith'
    });
  }
</script>

<h1>Mutation update</h1>

<button id="mutate" on:click={update}>Update User</button>
<button id="revert" on:click={revert}>Reset User</button>

<ul>
  {#each $usersList.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>

<pre>
  {stry($GQL_UpdateUser)}
</pre>
