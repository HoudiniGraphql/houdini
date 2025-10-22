<script lang="ts">
  import { EnumMutationStore, MyEnum, TypeOfUser } from '$houdini';

  const enumMutation = new EnumMutationStore();

  async function update() {
    await enumMutation.mutate({
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
  {JSON.stringify($enumMutation.data?.addUser?.enumValue === MyEnum.Value1)}
</div>

<div id="result-type">
  {JSON.stringify($enumMutation.data?.addUser?.types)}
</div>
