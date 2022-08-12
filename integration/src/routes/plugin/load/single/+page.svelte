<script lang="ts">
  import { Data } from './$types';

  export let data: Data;

  $: ({ SingleLoadQuery } = data);
</script>

{$SingleLoadQuery.data.user.id}
