<script lang="ts">
  import type { PageData } from './$houdini';
  export let data: PageData;

  $: console.log(data);

  // data: {
  //   [x: string]: any
  // }
</script>
