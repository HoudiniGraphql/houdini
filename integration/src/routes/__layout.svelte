<script context="module">
  import { houdiniClient } from '$lib/graphql/houdiniClient';
  import { routes } from '$lib/utils/routes';
  houdiniClient.init();
</script>

<script lang="ts">
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

<slot />
