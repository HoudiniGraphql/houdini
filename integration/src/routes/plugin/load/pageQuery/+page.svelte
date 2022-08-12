<script lang="ts">
  import { Data } from './$types';

  export let data: Data;

  $: ({ PageQuery } = data);
</script>

{$PageQuery.data.user.id}
