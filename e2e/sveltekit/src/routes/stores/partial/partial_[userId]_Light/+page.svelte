<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ Partial_User_Light } = data);
</script>

<a href="./partial_List">Back to the list</a>

<br />
<br />

<div id="id">
  {$Partial_User_Light.data?.user.id}
</div>
<div id="name">
  {$Partial_User_Light.data?.user.name}
</div>
