<script context="module">
  import { browser } from '$app/env';

  import { houdiniClient } from '$lib/graphql/houdiniClient';
  import { routes } from '$lib/utils/routes';
  import cache from '$houdini/runtime/cache';

  houdiniClient.init();

  if (browser) {
    // @ts-ignore
    window.cache = cache;
  }
</script>

<script lang="ts">
  let routesKvp = Object.keys(routes).map((key: string) => {
    return { key, value: (routes as Record<string, string>)[key] };
  });
</script>

<slot />

<hr />

<nav>
  {#each routesKvp as { key, value }}
    <div>
      <a href={value}>{key}</a>
    </div>
  {/each}
</nav>

