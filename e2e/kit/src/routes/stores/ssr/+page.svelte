<script lang="ts">
  import type { PageData } from './$houdini';

  export let data: PageData;
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
