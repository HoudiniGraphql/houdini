<script lang="ts">
  import { GQL_EnumMutation, MyEnum } from '$houdini';

  async function update() {
    await GQL_EnumMutation.mutate({
      variables: {
        birthDate: new Date(),
        name: 'Foo',
        snapshot: 'foo',
        value: MyEnum.Value1
      }
    });
  }
</script>

<h1>Mutation update</h1>

<button id="mutate" on:click={update}>Update User</button>

<div id="result">
  {JSON.stringify($GQL_EnumMutation.data?.addUser.enumValue === MyEnum.Value1)}
</div>
