<script lang="ts">
  export let data: any;

  $: ({ ListLoadQuery1, ListLoadQuery2 } = data);
</script>

{$ListLoadQuery1.data?.user.id},{$ListLoadQuery2.data?.user.id}
