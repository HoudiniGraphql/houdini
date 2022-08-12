<script lang="ts">
  import { Data } from './$types';

  export let data: Data;

  $: ({ ListLoadQuery1, ListLoadQuery2 } = data);
</script>

{$ListLoadQuery1.data.user.id},{$ListLoadQuery2.data.user.id}
