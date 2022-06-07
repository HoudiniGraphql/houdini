<script context="module" lang="ts">
  import { browser } from '$app/env';
  import { CachePolicy, GQL_usersList } from '$houdini';
</script>

<script lang="ts">
  $: browser && GQL_usersList.fetch();
</script>

<h1>NETWORK</h1>

<ul>
  {#each $GQL_usersList.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>
