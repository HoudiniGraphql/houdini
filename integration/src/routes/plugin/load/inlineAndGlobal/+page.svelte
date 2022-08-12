<script lang="ts">
  export let data: any;

  $: ({ Hello, ListLoadQuery2 } = data);
</script>

{$Hello.data.hello},{$ListLoadQuery2.data.user.id}
