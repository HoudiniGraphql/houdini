<script lang="ts">
  import { GQL_UpdateUser, graphql, MutationUpdateUsersListStore } from '$houdini';
  import { stry } from '@kitql/helper';

  const usersList: MutationUpdateUsersListStore = graphql`
    query MutationUpdateUsersList {
      usersList(limit: 5, snapshot: "update-user-mutation") {
        id
        name
        ...UserInfo
      }
    }
  `;

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
