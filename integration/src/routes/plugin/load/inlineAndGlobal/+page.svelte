<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  $: ({ Hello, InlineAndGlobalLoadQuery2 } = data);
</script>

{$Hello.data?.hello},{$InlineAndGlobalLoadQuery2.data?.user.id}
