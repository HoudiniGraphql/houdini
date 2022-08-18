<script lang="ts">
  export let data: any;

  $: ({ SingleLoadQuery } = data);
</script>

{$SingleLoadQuery.data?.user.id}
