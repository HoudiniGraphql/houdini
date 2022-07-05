<script lang="ts">
  import UserInfoStore from '$houdini/stores/UserInfo';
  import { MyEnum } from '$houdini';

  const data = UserInfoStore.get(null);

  console.log(MyEnum.Value1, MyEnum.Value2);
</script>

<div id="result">
  {$data}
</div>
