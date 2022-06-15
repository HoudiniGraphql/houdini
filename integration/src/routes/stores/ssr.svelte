<script context="module" lang="ts">
  import { browser } from '$app/env';
  import { GQL_Hello, GQL_usersList } from '$houdini';
  import type { LoadEvent } from '@sveltejs/kit';

  export async function load(event: LoadEvent) {
    await GQL_usersList.prefetch({ event });
    await GQL_Hello.prefetch({ event });
    return {};
  }
</script>

<script lang="ts">
  $: browser && GQL_usersList.fetch();
  $: browser && GQL_Hello.fetch();
</script>

<h1>SSR</h1>

<ul>
  {#each $GQL_usersList.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>

<div id="result">
  {$GQL_Hello.data?.hello}
</div>
