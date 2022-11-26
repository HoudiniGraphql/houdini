<script lang="ts">
  import { GQL_TwoOperationsAllUsers } from '$houdini';
  import TwoOperationsUser from './TwoOperationsUser.svelte';

  const startColor = 'mt-2 flex flex-wrap text-red-500';
  const normalColor = 'mt-2 flex flex-wrap text-blue-500';

  $: color = startColor;

  async function allUsers() {
    color = startColor;
    await GQL_TwoOperationsAllUsers.fetch();
    setTimeout(() => {
      color = normalColor;
    }, 1000);
  }
</script>

<button on:click={allUsers}>allUsers</button>
<br />

{#if $GQL_TwoOperationsAllUsers?.data}
  <pre class={color}>GQL_twoOperationsAllUsers: {JSON.stringify(
      $GQL_TwoOperationsAllUsers?.data,
      null,
      2
    )}</pre>
  <br />
{/if}
