<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/');
  });
</script>

<!-- <h1>{$page.status}: {$page.error.message}</h1> -->

User Not found...
