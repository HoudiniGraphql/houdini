<script lang="ts">
  import type { PageData } from './$houdini';

  const { data }: { data: PageData } = $props();
  const { Svelte5SimpleSSR } = $derived(data);
</script>

<div id="result">{$Svelte5SimpleSSR.data?.user.name}</div>
