<script lang="ts">
  import { Data } from './$types';

  export let data: Data;

  $: ({ Hello, ListLoadQuery2 } = data);
</script>

{$Hello.data.hello},{$ListLoadQuery2.data.user.id}
