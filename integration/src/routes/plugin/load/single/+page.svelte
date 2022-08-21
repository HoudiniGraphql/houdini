<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;

  $: ({ SingleLoadQuery } = data);
</script>

{$SingleLoadQuery.data?.user.id}
