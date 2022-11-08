<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ Partial_User } = data);
</script>

<a href="./partial_List">Back to the list</a>

<br />
<br />

<div id="id">
  {$Partial_User.data?.user.id}
</div>
<div id="name">
  {$Partial_User.data?.user.name}
</div>
<div id="birthDate">
  {$Partial_User.data?.user.birthDate?.toISOString()}
</div>
