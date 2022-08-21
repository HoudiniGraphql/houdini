<script lang="ts">
  import { GQL_UserInfo } from '$houdini';

  const data = GQL_UserInfo.get(null);
</script>

<div id="result">
  {JSON.stringify($data)}
</div>
