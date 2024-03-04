<script lang="ts">
    import { MyEnum } from '$houdini';
  import type { PageData } from './$houdini';

  export let data: PageData;
  $: ({ DescriptionPage } = data);
  $: monkey = $DescriptionPage.data?.monkey;

  $: if (monkey?.hasBanana) {
    console.log('🍌');
  }

  $: if ($DescriptionPage.data?.userResult.__typename === "User") {
    console.log($DescriptionPage.data.userResult.enumValue === MyEnum.Value1)
  }
</script>
