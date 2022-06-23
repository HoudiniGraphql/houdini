<script context="module">
  import { navigating } from '$app/stores';
  import { houdiniClient } from '$lib/graphql/houdiniClient';
  import { routes } from '$lib/utils/routes';

  houdiniClient.init();
</script>

<script lang="ts">
  $: console.log($navigating);
  let routesKvp = Object.keys(routes).map((key: string) => {
    return { key, value: (routes as any)[key] };
  });
</script>

<nav>
  {#each routesKvp as { key, value }}
    <div>
      <a href={value}>{key}</a>
    </div>
  {/each}
</nav>

<hr />

<slot />
