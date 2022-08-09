<script lang="ts">
  import type { Data } from './$types';
  export let data: Data;

  $: ({ usersList, Hello } = data);
</script>

<h1>SSR</h1>

<ul>
  {#each $usersList.data?.usersList ?? [] as user}
    <li>
      {user.id} - {user.name}
    </li>
  {/each}
</ul>

<div id="result">
  {$Hello.data?.hello}
</div>
