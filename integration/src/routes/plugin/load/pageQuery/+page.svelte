<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;

  $: ({ PageQuery } = data);
</script>

{$PageQuery.data?.user.id}
