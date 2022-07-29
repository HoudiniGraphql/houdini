<script lang="ts">
  import { graphql, mutation, query, type UserFive, type InlineUpdateUser } from '$houdini';

  const { data } = query<UserFive>(graphql`
    query UserFive {
      node(id: "preprocess-mutation:5") {
        ... on User {
          name
        }
      }
    }
  `);

  const mutate = mutation<InlineUpdateUser>(graphql`
    mutation InlineUpdateUser($id: ID!, $name: String!) {
      updateUser(id: $id, name: $name, snapshot: "preprocess-mutation") {
        id
        name
        birthDate
      }
    }
  `);

  function update() {
    mutate({ id: '5', name: 'tmp name update' });
  }
  function revert() {
    mutate({ id: '5', name: 'Will Smith' });
  }
</script>

<button id="mutate" on:click={update}>Update User</button>
<button id="revert" on:click={revert}>Reset User</button>

<div id="result">{$data?.node?.name}</div>
