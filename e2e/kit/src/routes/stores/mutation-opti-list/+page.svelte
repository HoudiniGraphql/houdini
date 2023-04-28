<script lang="ts">
  import { graphql, type ForceReturn$options } from '$houdini';

  $: query = graphql(`
    query OptimisticUsersList @load {
      usersList(snapshot: "mutation-opti-list", limit: 15) @list(name: "OptimisticUsersList") {
        name
      }
    }
  `);

  const addUser = graphql(`
    mutation AddUserOptiList($name: String!, $birthDate: DateTime!, $force: ForceReturn = NORMAL) {
      addUser(
        name: $name
        birthDate: $birthDate
        delay: 500
        snapshot: "mutation-opti-list"
        force: $force
      ) {
        ...OptimisticUsersList_insert
      }
    }
  `);

  const addNonNullUser = graphql(`
    mutation AddNonNullUserOptiList(
      $name: String!
      $birthDate: DateTime!
      $force: ForceReturn = NORMAL
    ) {
      addNonNullUser(
        name: $name
        birthDate: $birthDate
        delay: 500
        snapshot: "mutation-opti-list"
        force: $force
      ) {
        ...OptimisticUsersList_insert
      }
    }
  `);

  const addNonNull = async (force: ForceReturn$options = 'NORMAL') => {
    await addNonNullUser.mutate(
      { name: 'JYC', birthDate: new Date('1986-11-07'), force },
      {
        optimisticResponse: {
          addNonNullUser: {
            id: '??? id ???',
            name: '...optimisticResponse... I could have guessed JYC!'
          }
        }
      }
    );
  };

  const add = async (force: ForceReturn$options = 'NORMAL') => {
    await addUser.mutate(
      {
        name: 'JYC',
        birthDate: new Date('1986-11-07'),
        force
      },
      {
        optimisticResponse: {
          addUser: {
            id: '??? id ???',
            name: '...optimisticResponse... I could have guessed JYC!'
          }
        }
      }
    );
  };
</script>

<h1>Mutation Opti List</h1>

<button id="mutate" on:click={() => add()}>Add User</button>
<button id="mutate-null" on:click={() => add('NULL')}>Add User (null)</button>
<button id="mutate-error" on:click={() => addNonNull('ERROR')}>Add User (error)</button>

<div id="result">
  {$query.data?.usersList.map((user) => user.name).join(', ')}
</div>
