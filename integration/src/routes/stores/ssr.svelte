<script context="module" lang="ts">
  import { GQL_usersList } from '$houdini';
  import type { LoadEvent } from '@sveltejs/kit';

  export async function load(load: LoadEvent) {
    await GQL_usersList.queryLoad({ context: load });
    return {};
  }
</script>

<h1>SSR</h1>

<ul>
  {#each $GQL_usersList.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>
