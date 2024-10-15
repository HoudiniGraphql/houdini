<script lang="ts">
  import { MultiUserStore } from '$houdini';
  import { onMount } from 'svelte';

  const variables1 = { id: '1' };
  const u1 = new MultiUserStore();

  const variables5 = { id: '5' };
  const u5 = new MultiUserStore();

  onMount(() => {
    u1.fetch({ variables: variables1 });
    u5.fetch({ variables: variables5 });
  });
</script>

<h1>network-one-store-multivariables</h1>

<div id="result">
  {$u1.data?.user.id} - {$u1.data?.user.name}
</div>

<div id="result-5">
  {$u5.data?.user.id} - {$u5.data?.user.name}
</div>
