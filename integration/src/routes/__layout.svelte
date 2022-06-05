<script context="module">
  import { houdiniClient } from '$lib/graphql/houdiniClient';
  import { routes } from '$lib/utils/routes';
  houdiniClient.init();
</script>

<script lang="ts">
  import { page } from '$app/stores';

  let routesKvp = Object.keys(routes).map((key: string) => {
    return { key, value: (routes as any)[key] };
  });

  const currentLocation = $page.url.pathname;
</script>

<nav>
  {#each routesKvp as { key, value }}
    <div>
      <a href={value}>{key}</a>
    </div>
  {/each}
</nav>

<slot />
