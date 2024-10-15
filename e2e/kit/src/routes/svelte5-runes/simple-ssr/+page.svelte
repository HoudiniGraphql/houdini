<script lang="ts">
  import type { PageData } from './$houdini';

  interface Props {
    data: PageData;
  }
  const { data }: Props = $props();
  const { Svelte5SimpleSSR } = $derived(data);
</script>

<div id="result">{$Svelte5SimpleSSR.data?.user.name}</div>
