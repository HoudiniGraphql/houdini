<script lang="ts">
  import { UserInfoStore } from '$houdini';

  const userInfo = new UserInfoStore();
  const data = userInfo.get(null);
</script>

<div id="result">
  {JSON.stringify($data)}
</div>
