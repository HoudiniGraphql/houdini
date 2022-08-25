<script lang="ts">
  import { GQL_EnumMutation, MyEnum, TypeOfUser } from '$houdini';

  async function update() {
    await GQL_EnumMutation.mutate({
      birthDate: new Date(),
      name: 'Foo',
      snapshot: 'foo',
      value: MyEnum.Value1,
      types: [TypeOfUser.COOL, TypeOfUser.NICE]
    });
  }
</script>

<h1>Mutation update</h1>

<button id="mutate" on:click={update}>Update User</button>

<div id="result">
  {JSON.stringify($GQL_EnumMutation.data?.addUser.enumValue === MyEnum.Value1)}
</div>

<div id="result-type">
  {JSON.stringify($GQL_EnumMutation.data?.addUser.types)}
</div>
