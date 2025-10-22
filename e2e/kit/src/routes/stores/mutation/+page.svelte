<script lang="ts">
  import { graphql, UpdateUserStore } from '$houdini';
  import { stringify } from '$lib/utils/stringify';
  import type { PageData } from './$types';

  export let data: PageData;

  $: ({ OptimisticUserQuery : query } = data)

  const updateUser = new UpdateUserStore();

  async function add() {
    await updateUser.mutate(
      { id: '1', name: 'JYC', birthDate: new Date('1986-11-07') },
      {
        optimisticResponse: {
          updateUser: {
            id: 'update-user-mutation:1',
            name: '...optimisticResponse... I could have guessed JYC!'
          }
        }
      }
    );
  }
</script>

<h1>Mutation</h1>

<button id="mutate" on:click={add}>Add User</button>

<div id="result">
  {$query.data?.user.name}
</div>

<div id="store-value">
  {stringify($updateUser)}
</div>
