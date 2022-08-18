<script lang="ts">
  export let data: any;

  $: ({ PageQuery } = data);
</script>

{$PageQuery.data?.user.id}
