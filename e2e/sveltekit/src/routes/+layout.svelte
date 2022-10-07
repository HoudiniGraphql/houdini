<script lang="ts">
  import { browser } from '$app/environment';
  import { graphql } from '$houdini';
  import cache from '$houdini/runtime/cache';
  import { routes } from '$lib/utils/routes.js';

  if (browser) {
    // @ts-ignore
    window.cache = cache;
  }

  let routesKvp = Object.keys(routes).map((key: string) => {
    return { key, value: (routes as Record<string, string>)[key] };
  });

  const info = graphql`
    query LayoutSession {
      session
    }
  `;
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

<div id="layout-session">
  {$info.data?.session}
</div>
