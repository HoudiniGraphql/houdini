<script lang="ts">
  import UserInfoStore from '$houdini/stores/UserInfo';

  const data = UserInfoStore.get(null);
</script>

<div id="result">
  {JSON.stringify($data)}
</div>
