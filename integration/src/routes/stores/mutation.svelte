<script lang="ts">
  import { GQL_AddUser } from '$houdini';
  import { stry } from '@kitql/helper';

  async function add() {
    await GQL_AddUser.mutate({
      variables: { name: 'JYC', birthDate: new Date('1986-11-07'), delay: 1000 },
      optimisticResponse: {
        addUser: {
          id: '???',
          name: '...optimisticResponse... I could have guessed JYC!',
          birthDate: new Date('1986-11-07')
        }
      }
    });
  }
</script>

<h1>SSR</h1>

<button id="mutate" on:click={add}>Add User</button>

<pre>
  {stry($GQL_AddUser)}
</pre>
