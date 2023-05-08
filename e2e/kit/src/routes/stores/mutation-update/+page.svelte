<script lang="ts">
  import { graphql } from '$houdini';
  import { stry } from '@kitql/helper';
  import type { PageData } from './$types';

  export let data: PageData;

  // leave this awkward pattern to make sure this doesn't come back: https://github.com/HoudiniGraphql/houdini/issues/543
  let { TestMutationUpdateUsersList } = data;
  $: ({ TestMutationUpdateUsersList } = data);

  const mutation = graphql(`
    mutation MutationUpdate_UpdateUser($id: ID!, $name: String, $birthDate: DateTime) {
      updateUser(
        id: $id
        name: $name
        birthDate: $birthDate
        snapshot: "MutationUpdate_UpdateUser"
        delay: 1000
      ) {
        id
        name
        birthDate
      }
    }
  `);

  async function update() {
    await mutation.mutate({
      id: '5',
      name: 'tmp name update'
    });
  }
  async function revert() {
    await mutation.mutate({
      id: '5',
      name: 'Will Smith'
    });
  }
</script>

<h1>Mutation update</h1>

<button id="mutate" on:click={update}>Update User</button>
<button id="revert" on:click={revert}>Reset User</button>

<ul>
  {#each $TestMutationUpdateUsersList.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>

<pre>{stry($mutation)}</pre>
