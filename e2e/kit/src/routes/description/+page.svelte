<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;
  $: ({ DescriptionPage } = data);
  $: monkey = $DescriptionPage.data?.monkey;

  $: if (monkey?.hasBanana) {
    console.log('🍌');
  }
</script>
