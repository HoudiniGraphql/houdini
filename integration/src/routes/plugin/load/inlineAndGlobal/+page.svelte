<script lang="ts">
  export let data: any;

  $: ({ Hello, InlineAndGlobalLoadQuery2 } = data);
</script>

{$Hello.data?.hello},{$InlineAndGlobalLoadQuery2.data?.user.id}
