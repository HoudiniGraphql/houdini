<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;

  $: ({ SingleLoadQuery } = data);
</script>

{$SingleLoadQuery.data?.user.id}
