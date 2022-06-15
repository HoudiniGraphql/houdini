<script context="module" lang="ts">
  import { browser } from '$app/env';
  import { GQL_usersList } from '$houdini';
  import type { LoadEvent } from '@sveltejs/kit';

  export async function load(event: LoadEvent) {
    await GQL_usersList.prefetch({ event });
    return {};
  }
</script>

<script lang="ts">
  $: browser && GQL_usersList.load();
</script>

<h1>SSR</h1>

<ul>
  {#each $GQL_usersList.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>
