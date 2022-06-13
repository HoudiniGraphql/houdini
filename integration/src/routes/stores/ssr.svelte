<script context="module" lang="ts">
  import { GQL_Hello, GQL_usersList } from '$houdini';
  import type { LoadEvent } from '@sveltejs/kit';

  export async function load(event: LoadEvent) {
    await GQL_usersList.fetch({ event });
    await GQL_Hello.fetch({ event });
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

<div id="result">
  {$GQL_Hello.data?.hello}
</div>
